import {
  Prisma,
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentScheme,
  X402PaymentStatus,
} from "@masumi/database";
import prisma from "@masumi/database/client";
import { x402Facilitator } from "@x402/core/facilitator";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme as registerExactEvmFacilitatorScheme } from "@x402/evm/exact/facilitator";
import createHttpError from "http-errors";
import { createWalletClient, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { decrypt } from "./encryption.js";
import {
  assertRpcServesDeclaredChain,
  createChain,
  getX402NetworkOrThrow,
  normalizeAddress,
  type PrivateKey,
  safeHttpTransport,
} from "./internal.js";
import { logger } from "./logger.js";
import { isAllowedCaip2Network } from "./network.js";
import {
  encryptPaymentPayloadForStorage,
  getPaymentIdentifier,
  hashX402PaymentPayload,
} from "./payment-payload.js";
import { resolveX402TenantScope, type X402ScopeInput } from "./tenant-scope.js";

const EXACT_SCHEME = "exact";
const DEFAULT_X402_TIMEOUT_SECONDS = 300;
const PERMIT2_EXTRA = { assetTransferMethod: "permit2" };

type X402SourceRecord = NonNullable<
  Awaited<ReturnType<typeof getX402SupportedPaymentSourceOrThrow>>
>;

type X402RequirementExtra = {
  assetTransferMethod?: unknown;
  decimals?: unknown;
};

// Largest value the Postgres BigInt (signed 64-bit) settlement-amount column can hold.
const POSTGRES_BIGINT_MAX = 9223372036854775807n;

// Parse an unsigned-integer string to BigInt, returning null for null/undefined or
// any non-integer form. Used for amounts that arrive from external services where a
// malformed value must not throw (e.g. after an irreversible on-chain settle).
// Also returns null for values that overflow the int64 column: the settle already
// happened on-chain, so recording a null amount is far better than throwing on the DB
// write and losing the settlement record entirely (the tx hash is the source of truth).
function parseUintStringOrNull(
  value: string | null | undefined,
): bigint | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed > POSTGRES_BIGINT_MAX) return null;
  return parsed;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const parsed: unknown = JSON.parse(
    JSON.stringify(value, (_key: string, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
  return parsed as Prisma.InputJsonValue;
}

function toJsonObject(
  value: Prisma.JsonValue | null | undefined,
): Prisma.JsonObject {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function toRequirementExtra(value: unknown): X402RequirementExtra {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as X402RequirementExtra;
  }
  return {};
}
function sourceToRequirements(source: X402SourceRecord): PaymentRequirements {
  if (source.scheme !== X402PaymentScheme.Exact) {
    throw createHttpError(400, "Only x402 exact payment sources are supported");
  }
  if (
    source.asset == null ||
    source.amount == null ||
    source.payTo == null ||
    source.decimals == null
  ) {
    throw createHttpError(400, "x402 supported payment source is incomplete");
  }

  return {
    scheme: EXACT_SCHEME,
    network: source.network as Network,
    asset: source.asset,
    amount: source.amount.toString(),
    payTo: source.payTo,
    maxTimeoutSeconds: DEFAULT_X402_TIMEOUT_SECONDS,
    extra: {
      ...toJsonObject(source.extra),
      ...PERMIT2_EXTRA,
      decimals: source.decimals,
    },
  };
}

function resourceMatchesRegisteredResource(
  registeredResource: string,
  candidate: string,
): boolean {
  return candidate === registeredResource;
}

function assertPaymentPayloadMatchesRegisteredResource(
  source: X402SourceRecord,
  paymentPayload: PaymentPayload,
) {
  if (source.resource == null) return;
  const payloadResourceUrl = paymentPayload.resource?.url;
  if (payloadResourceUrl == null) {
    throw createHttpError(
      400,
      "x402 payment payload resource is required for this registered resource",
    );
  }
  if (!resourceMatchesRegisteredResource(source.resource, payloadResourceUrl)) {
    throw createHttpError(
      400,
      "x402 payment payload resource does not match the registered resource",
    );
  }
}

async function getX402SupportedPaymentSourceOrThrow(
  supportedPaymentSourceId: string,
) {
  const source = await prisma.supportedPaymentSource.findUnique({
    where: { id: supportedPaymentSourceId },
    include: {
      agent: {
        select: {
          id: true,
          apiUrl: true,
          agentIdentifier: true,
          userId: true,
          organizationId: true,
        },
      },
    },
  });
  if (source == null || source.chain !== "EVM") {
    throw createHttpError(404, "x402 supported payment source not found");
  }
  return source;
}

/**
 * Inbound verify/settle must be authorized against the *caller's* tenant, not just the
 * source id: the facilitator wallet that signs and pays gas belongs to the source owner, so
 * an unscoped source lookup would let any authenticated tenant spend another tenant's wallet.
 * Returns 404 (not 403) to avoid disclosing that a source id exists in another tenant.
 */
function assertSupportedSourceOwnedByCaller(
  agent: { userId: string; organizationId: string | null } | null | undefined,
  caller: X402ScopeInput,
) {
  const callerScope = resolveX402TenantScope(caller);
  const ownedByCaller =
    callerScope.mode === "org"
      ? agent?.organizationId === callerScope.organizationId
      : agent?.organizationId == null && agent?.userId === callerScope.userId;
  if (!ownedByCaller) {
    throw createHttpError(404, "x402 supported payment source not found");
  }
}

/** Inbound facilitator lookup: org agents share org x402 config; personal agents use owner userId. */
function facilitatorScopeForAgent(
  agent: { userId: string; organizationId: string | null } | null | undefined,
  fallbackUserId: string,
): X402ScopeInput {
  if (agent?.organizationId) {
    return { userId: fallbackUserId, organizationId: agent.organizationId };
  }
  return { userId: agent?.userId ?? fallbackUserId, organizationId: null };
}
async function getFacilitatorNetwork(
  scopeInput: X402ScopeInput,
  caip2Network: string,
) {
  const network = await getX402NetworkOrThrow(scopeInput, caip2Network);
  if (network.FacilitatorWallet == null) {
    throw createHttpError(
      400,
      "x402 network has no facilitator wallet configured",
    );
  }
  // A retired (soft-deleted) facilitator key must never sign settlements, even if it is
  // still attached to the network (e.g. re-assigned after deletion).
  if (network.FacilitatorWallet.deletedAt != null) {
    throw createHttpError(
      400,
      "x402 network facilitator wallet has been retired",
    );
  }
  // Defense-in-depth: a facilitator settles inbound payments, so it must be a Selling
  // wallet. Assignment is already gated in upsertX402Network, but enforce at use too in
  // case a wallet's role changed after it was wired up.
  if (network.FacilitatorWallet.type !== X402EvmWalletType.Selling) {
    throw createHttpError(
      400,
      "x402 network facilitator wallet is not a Selling wallet",
    );
  }

  return { ...network, FacilitatorWallet: network.FacilitatorWallet };
}

async function getLocalFacilitator(
  network: Awaited<ReturnType<typeof getFacilitatorNetwork>>,
) {
  const facilitatorEncryptedKey = network.FacilitatorWallet.encryptedPrivateKey;
  if (facilitatorEncryptedKey == null) {
    if (network.FacilitatorWallet.paymentNodeWalletId != null) {
      throw createHttpError(
        501,
        "The facilitator wallet is custodied on the payment node; use the payment-node verify/settle path",
      );
    }
    throw createHttpError(500, "Facilitator wallet has no signing key");
  }

  const privateKey = decrypt(facilitatorEncryptedKey) as PrivateKey;
  const account = privateKeyToAccount(privateKey);
  const chain = createChain(
    network.caip2Id,
    network.rpcUrl,
    network.displayName,
  );
  const walletClient = createWalletClient({
    account,
    chain,
    transport: safeHttpTransport(network.rpcUrl),
  }).extend(publicActions);
  await assertRpcServesDeclaredChain(walletClient, network.caip2Id);
  const facilitatorSigner = toFacilitatorEvmSigner(
    Object.assign(walletClient, {
      address: account.address,
    }) as Parameters<typeof toFacilitatorEvmSigner>[0],
  );
  const facilitator = new x402Facilitator();

  registerExactEvmFacilitatorScheme(facilitator, {
    signer: facilitatorSigner,
    networks: network.caip2Id as Network,
  });

  return facilitator;
}
async function writeSettlement({
  attemptId,
  paymentPayloadHash,
  settleResponse,
}: {
  attemptId: string;
  paymentPayloadHash: string;
  settleResponse: SettleResponse;
}) {
  return prisma.x402Settlement.upsert({
    where: { paymentPayloadHash },
    create: {
      paymentAttemptId: attemptId,
      paymentPayloadHash,
      success: settleResponse.success,
      txHash: settleResponse.transaction,
      caip2Network: settleResponse.network,
      // Runs after the on-chain settle has already moved funds; a malformed facilitator
      // amount must not throw and lose the settlement record. Store null on bad input.
      amount: parseUintStringOrNull(settleResponse.amount),
      payer: settleResponse.payer,
      rawResponse: toJsonValue(settleResponse),
    },
    update: {},
  });
}
function assertRequirementsMatchRegisteredSource(
  requirements: PaymentRequirements,
  expected: PaymentRequirements,
) {
  const requirementsExtra = toRequirementExtra(requirements.extra);
  const expectedExtra = toRequirementExtra(expected.extra);
  if (
    requirements.scheme !== EXACT_SCHEME ||
    requirements.network !== expected.network ||
    normalizeAddress(requirements.asset) !== normalizeAddress(expected.asset) ||
    requirements.amount !== expected.amount ||
    normalizeAddress(requirements.payTo) !== normalizeAddress(expected.payTo) ||
    // Pin maxTimeoutSeconds too, mirroring requirementsMatch, so the signing window
    // cannot drift from the registered policy.
    requirements.maxTimeoutSeconds !== expected.maxTimeoutSeconds ||
    requirementsExtra.assetTransferMethod !==
      PERMIT2_EXTRA.assetTransferMethod ||
    // decimals arrives untyped from the wire (may be number or string); compare
    // by canonical string form so 6 and "6" are treated as equal.
    String(requirementsExtra.decimals) !== String(expectedExtra.decimals)
  ) {
    throw createHttpError(
      400,
      "Remote x402 payment requirements do not match the registered resource",
    );
  }
}

function assertPayloadRequirementsMatchRegisteredSource(
  requirements: PaymentRequirements,
  expected: PaymentRequirements,
) {
  try {
    assertRequirementsMatchRegisteredSource(requirements, expected);
  } catch {
    throw createHttpError(
      400,
      "x402 payment requirements do not match the registered resource",
    );
  }
}
export type X402InboundPaymentNodeContext = {
  agentId: string;
  requirements: PaymentRequirements;
  registeredResource: string | null;
  paymentPayload: PaymentPayload;
};

export async function verifyX402Payment({
  userId,
  organizationId,
  apiKeyId,
  caip2NetworkLimit,
  supportedPaymentSourceId,
  paymentPayload,
  verifyOnPaymentNode,
}: {
  userId: string;
  organizationId?: string | null;
  apiKeyId?: string | null;
  caip2NetworkLimit: string[] | null;
  supportedPaymentSourceId: string;
  paymentPayload: PaymentPayload;
  verifyOnPaymentNode?: (
    context: X402InboundPaymentNodeContext,
  ) => Promise<VerifyResponse>;
}) {
  const source = await getX402SupportedPaymentSourceOrThrow(
    supportedPaymentSourceId,
  );
  assertSupportedSourceOwnedByCaller(source.agent, { userId, organizationId });
  assertPaymentPayloadMatchesRegisteredResource(source, paymentPayload);
  const requirements = sourceToRequirements(source);
  if (!isAllowedCaip2Network(caip2NetworkLimit, requirements.network)) {
    throw createHttpError(401, "Unauthorized network");
  }
  assertPayloadRequirementsMatchRegisteredSource(
    paymentPayload.accepted,
    requirements,
  );
  const facilitatorScope = facilitatorScopeForAgent(source.agent, userId);
  const network = await getFacilitatorNetwork(
    facilitatorScope,
    requirements.network,
  );
  const paymentPayloadHash = hashX402PaymentPayload(paymentPayload);
  const identifier = getPaymentIdentifier(paymentPayload);
  if (identifier.errors.length > 0) {
    throw createHttpError(400, identifier.errors.join("; "));
  }

  const verifyResponse =
    network.FacilitatorWallet.encryptedPrivateKey == null &&
    network.FacilitatorWallet.paymentNodeWalletId != null &&
    verifyOnPaymentNode != null
      ? await verifyOnPaymentNode({
          agentId: source.agentId,
          requirements,
          registeredResource: source.resource,
          paymentPayload,
        })
      : await (
          await getLocalFacilitator(network)
        ).verify(paymentPayload, requirements);
  if (!verifyResponse.isValid) {
    logger.warn("x402 verify returned invalid", {
      supportedPaymentSourceId,
      paymentPayloadHash,
      invalidReason: verifyResponse.invalidReason,
      invalidMessage: verifyResponse.invalidMessage,
    });
  }
  const attempt = await prisma.x402PaymentAttempt.create({
    data: {
      direction: X402PaymentDirection.InboundVerify,
      status: verifyResponse.isValid
        ? X402PaymentStatus.Verified
        : X402PaymentStatus.Failed,
      userId: network.userId,
      x402NetworkId: network.id,
      apiKeyId: apiKeyId ?? null,
      agentId: source.agentId,
      supportedPaymentSourceId,
      caip2Network: requirements.network,
      scheme: X402PaymentScheme.Exact,
      asset: requirements.asset,
      amount: BigInt(requirements.amount),
      payTo: requirements.payTo,
      payer: verifyResponse.payer,
      // Attribute to the registered resource only; the payload resource is buyer-supplied
      // and is unvalidated when the source pins no resource, so it must not be persisted.
      resource: source.resource,
      paymentPayloadHash,
      paymentPayload: encryptPaymentPayloadForStorage(paymentPayload),
      paymentIdentifier: identifier.id,
      errorReason: verifyResponse.invalidReason,
      errorMessage: verifyResponse.invalidMessage,
    },
    select: { id: true },
  });

  return {
    attemptId: attempt.id,
    paymentPayloadHash,
    paymentIdentifier: identifier.id,
    verifyResponse,
  };
}

export async function settleX402Payment({
  userId,
  organizationId,
  apiKeyId,
  caip2NetworkLimit,
  supportedPaymentSourceId,
  paymentPayload,
  settleOnPaymentNode,
}: {
  userId: string;
  organizationId?: string | null;
  apiKeyId?: string | null;
  caip2NetworkLimit: string[] | null;
  supportedPaymentSourceId: string;
  paymentPayload: PaymentPayload;
  settleOnPaymentNode?: (
    context: X402InboundPaymentNodeContext,
  ) => Promise<SettleResponse>;
}) {
  const source = await getX402SupportedPaymentSourceOrThrow(
    supportedPaymentSourceId,
  );
  assertSupportedSourceOwnedByCaller(source.agent, { userId, organizationId });
  assertPaymentPayloadMatchesRegisteredResource(source, paymentPayload);
  const requirements = sourceToRequirements(source);
  if (!isAllowedCaip2Network(caip2NetworkLimit, requirements.network)) {
    throw createHttpError(401, "Unauthorized network");
  }
  assertPayloadRequirementsMatchRegisteredSource(
    paymentPayload.accepted,
    requirements,
  );
  const paymentPayloadHash = hashX402PaymentPayload(paymentPayload);
  const identifier = getPaymentIdentifier(paymentPayload);
  if (identifier.errors.length > 0) {
    throw createHttpError(400, identifier.errors.join("; "));
  }

  // Idempotency model: this dedup lookup plus the X402Settlement.paymentPayloadHash
  // unique constraint (writeSettlement is an upsert with an empty update) keep the
  // DB record single. The check-then-settle is not locked across the on-chain call,
  // so two concurrent settles of the SAME payload can both reach facilitator.settle;
  // the on-chain authorization is single-use (Permit2/EIP-3009 nonce), so the second
  // reverts on-chain — no double-spend, only a wasted tx. A cross-process lock would
  // have to hold a DB connection across the settle and is intentionally avoided.
  const existingSettlement = await prisma.x402Settlement.findUnique({
    where: { paymentPayloadHash },
    include: {
      PaymentAttempt: {
        select: {
          id: true,
          payer: true,
          supportedPaymentSourceId: true,
          userId: true,
          x402NetworkId: true,
        },
      },
    },
  });
  if (existingSettlement != null) {
    // Replay must be bound to the same registered source: the same on-chain
    // payment authorization (hence payload hash) settled for one source must not
    // return a fake success for a different source with identical economics.
    if (
      existingSettlement.PaymentAttempt.supportedPaymentSourceId !==
      supportedPaymentSourceId
    ) {
      throw createHttpError(
        409,
        "payment payload was already settled for a different registered resource",
      );
    }
    const replayAttempt = await prisma.x402PaymentAttempt.create({
      data: {
        direction: X402PaymentDirection.InboundSettle,
        status: X402PaymentStatus.Replayed,
        userId: existingSettlement.PaymentAttempt.userId,
        x402NetworkId: existingSettlement.PaymentAttempt.x402NetworkId,
        apiKeyId: apiKeyId ?? null,
        agentId: source.agentId,
        supportedPaymentSourceId,
        caip2Network: requirements.network,
        scheme: X402PaymentScheme.Exact,
        asset: requirements.asset,
        amount: BigInt(requirements.amount),
        payTo: requirements.payTo,
        payer:
          existingSettlement.payer ?? existingSettlement.PaymentAttempt.payer,
        // Registered resource only; never persist the buyer-supplied payload resource.
        resource: source.resource,
        paymentPayloadHash,
        paymentPayload: encryptPaymentPayloadForStorage(paymentPayload),
        paymentIdentifier: identifier.id,
      },
      select: { id: true },
    });

    return {
      attemptId: replayAttempt.id,
      paymentPayloadHash,
      paymentIdentifier: identifier.id,
      replay: true,
      settleResponse: {
        success: true,
        transaction: existingSettlement.txHash ?? "",
        network: existingSettlement.caip2Network as Network,
        amount: existingSettlement.amount?.toString(),
        payer:
          existingSettlement.payer ??
          existingSettlement.PaymentAttempt.payer ??
          undefined,
      },
    };
  }

  const facilitatorScope = facilitatorScopeForAgent(source.agent, userId);
  const network = await getFacilitatorNetwork(
    facilitatorScope,
    requirements.network,
  );
  const settleResponse =
    network.FacilitatorWallet.encryptedPrivateKey == null &&
    network.FacilitatorWallet.paymentNodeWalletId != null &&
    settleOnPaymentNode != null
      ? await settleOnPaymentNode({
          agentId: source.agentId,
          requirements,
          registeredResource: source.resource,
          paymentPayload,
        })
      : await (
          await getLocalFacilitator(network)
        ).settle(paymentPayload, requirements);
  if (!settleResponse.success) {
    logger.warn("x402 settle returned unsuccessful", {
      supportedPaymentSourceId,
      paymentPayloadHash,
      errorReason: settleResponse.errorReason,
      errorMessage: settleResponse.errorMessage,
    });
  }
  const attempt = await prisma.x402PaymentAttempt.create({
    data: {
      direction: X402PaymentDirection.InboundSettle,
      status: settleResponse.success
        ? X402PaymentStatus.Settled
        : X402PaymentStatus.Failed,
      userId: network.userId,
      x402NetworkId: network.id,
      apiKeyId: apiKeyId ?? null,
      agentId: source.agentId,
      supportedPaymentSourceId,
      caip2Network: requirements.network,
      scheme: X402PaymentScheme.Exact,
      asset: requirements.asset,
      amount: BigInt(requirements.amount),
      payTo: requirements.payTo,
      payer: settleResponse.payer,
      // Registered resource only; never persist the buyer-supplied payload resource.
      resource: source.resource,
      paymentPayloadHash,
      paymentPayload: encryptPaymentPayloadForStorage(paymentPayload),
      paymentIdentifier: identifier.id,
      errorReason: settleResponse.errorReason,
      errorMessage: settleResponse.errorMessage,
    },
    select: { id: true },
  });

  if (settleResponse.success) {
    await writeSettlement({
      attemptId: attempt.id,
      paymentPayloadHash,
      settleResponse,
    });
  }

  return {
    attemptId: attempt.id,
    paymentPayloadHash,
    paymentIdentifier: identifier.id,
    replay: false,
    settleResponse,
    // Webhook-ready summary for the route handler to emit (settled or failed). Not part
    // of the HTTP response schema; the route strips it before responding.
    webhook: {
      attemptId: attempt.id,
      paymentPayloadHash,
      supportedPaymentSourceId,
      agentId: source.agentId,
      caip2Network: requirements.network,
      asset: requirements.asset,
      amount: requirements.amount,
      payTo: requirements.payTo,
      payer: settleResponse.payer ?? null,
      txHash: settleResponse.transaction ?? null,
      success: settleResponse.success,
      errorReason: settleResponse.errorReason ?? null,
      errorMessage: settleResponse.errorMessage ?? null,
    },
  };
}
