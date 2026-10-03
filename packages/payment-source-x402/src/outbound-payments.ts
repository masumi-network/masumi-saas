import {
  Prisma,
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentScheme,
  X402PaymentStatus,
} from "@masumi/database";
import prisma from "@masumi/database/client";
import { x402Client } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type {
  Network,
  PaymentRequired,
  PaymentRequirements,
} from "@x402/core/types";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme as registerExactEvmClientScheme } from "@x402/evm/exact/client";
import {
  appendPaymentIdentifierToExtensions,
  PAYMENT_IDENTIFIER,
} from "@x402/extensions/payment-identifier";
import canonicalStringify from "canonical-json";
import createHttpError from "http-errors";
import { createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { decrypt } from "./encryption.js";
import {
  assertRpcServesDeclaredChain,
  createChain,
  getEip155ChainId,
  getManagedWalletOrThrow,
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
import {
  networkOwnershipWhere,
  resolveX402TenantScope,
  type X402ScopeInput,
} from "./tenant-scope.js";

const EXACT_SCHEME = "exact";

function isHttpStatusCarrier(
  error: unknown,
): error is Error & { status: number } {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    Number.isInteger((error as { status: number }).status) &&
    (error as { status: number }).status >= 400 &&
    (error as { status: number }).status <= 599
  );
}
async function getClientForWallet(
  scopeInput: X402ScopeInput,
  walletId: string,
  caip2Network: string,
) {
  const [wallet, network] = await Promise.all([
    getManagedWalletOrThrow(scopeInput, walletId, X402EvmWalletType.Purchasing),
    getX402NetworkOrThrow(scopeInput, caip2Network),
  ]);
  const privateKey =
    wallet.encryptedPrivateKey != null
      ? (decrypt(wallet.encryptedPrivateKey) as PrivateKey)
      : null;
  if (privateKey == null) {
    if (wallet.paymentNodeWalletId != null) {
      throw createHttpError(
        501,
        "This wallet's private key is custodied on the payment node; use the payment-node signing path",
      );
    }
    throw createHttpError(500, "Managed EVM wallet has no signing key");
  }
  const account = privateKeyToAccount(privateKey);
  const chain = createChain(
    network.caip2Id,
    network.rpcUrl,
    network.displayName,
  );
  const publicClient = createPublicClient({
    chain,
    transport: safeHttpTransport(network.rpcUrl),
  });
  await assertRpcServesDeclaredChain(publicClient, network.caip2Id);
  const signer = toClientEvmSigner(account, publicClient);
  const client = new x402Client();
  const chainId = getEip155ChainId(network.caip2Id);

  registerExactEvmClientScheme(client, {
    signer,
    networks: [network.caip2Id as Network],
    schemeOptions: {
      [chainId]: { rpcUrl: network.rpcUrl },
    },
  });

  return {
    client,
    network,
    wallet,
    payer: account.address,
  };
}
async function reserveBudgetForAttempt({
  x402NetworkId,
  networkUserId,
  apiKeyId,
  evmWalletId,
  requirements,
  payer,
}: {
  x402NetworkId: string;
  networkUserId: string;
  apiKeyId: string;
  evmWalletId: string;
  requirements: PaymentRequirements;
  payer: string;
}) {
  const amount = BigInt(requirements.amount);
  const asset = normalizeAddress(requirements.asset);
  const payTo = normalizeAddress(requirements.payTo);
  const budgetAndAttempt = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const budget = await tx.x402WalletBudget.findFirst({
        where: {
          apiKeyId,
          evmWalletId,
          caip2Network: requirements.network,
          asset,
          enabled: true,
        },
        select: { id: true },
      });
      if (budget == null) {
        throw createHttpError(403, "x402 wallet budget not found");
      }

      const updateResult = await tx.x402WalletBudget.updateMany({
        where: {
          id: budget.id,
          enabled: true,
          remainingAmount: { gte: amount },
        },
        data: {
          remainingAmount: { decrement: amount },
          spentAmount: { increment: amount },
        },
      });
      if (updateResult.count !== 1) {
        throw createHttpError(402, "Insufficient x402 wallet budget");
      }

      const attempt = await tx.x402PaymentAttempt.create({
        data: {
          direction: X402PaymentDirection.OutboundPayment,
          status: X402PaymentStatus.PaymentRequired,
          userId: networkUserId,
          x402NetworkId,
          apiKeyId,
          evmWalletId,
          caip2Network: requirements.network,
          scheme: X402PaymentScheme.Exact,
          asset,
          amount,
          payTo,
          payer,
        },
        select: { id: true },
      });

      return { budgetId: budget.id, attemptId: attempt.id, amount };
    },
  );

  return budgetAndAttempt;
}

async function refundBudgetReservation(
  reservation: { budgetId: string; amount: bigint } | null,
) {
  if (reservation == null) return;
  await prisma.x402WalletBudget.update({
    where: { id: reservation.budgetId },
    data: {
      remainingAmount: { increment: reservation.amount },
      spentAmount: { decrement: reservation.amount },
    },
  });
}
function requirementsMatch(
  a: PaymentRequirements,
  b: PaymentRequirements,
): boolean {
  // Match on every economically- and authorization-relevant field, including
  // maxTimeoutSeconds and the full `extra` (transfer method / EIP-712 domain), so
  // the signing policy pins to the exact selected variant and the SDK cannot sign a
  // different accepts[] entry that happens to share the core economics.
  return (
    a.scheme === b.scheme &&
    a.network === b.network &&
    normalizeAddress(a.asset) === normalizeAddress(b.asset) &&
    a.amount === b.amount &&
    normalizeAddress(a.payTo) === normalizeAddress(b.payTo) &&
    a.maxTimeoutSeconds === b.maxTimeoutSeconds &&
    canonicalStringify(a.extra ?? {}) === canonicalStringify(b.extra ?? {})
  );
}
type OutboundX402PaymentParams = {
  userId: string;
  organizationId?: string | null;
  apiKeyId: string;
  caip2NetworkLimit: string[] | null;
  evmWalletId: string;
  paymentRequired: PaymentRequired;
  preferredNetwork?: string;
  preferredAsset?: string;
};

type SelectedOutboundX402Payment = {
  scopeInput: X402ScopeInput;
  selected: PaymentRequirements;
  selectedX402NetworkId: string;
  selectedNetworkUserId: string;
  payer: string;
};

async function selectOutboundX402Requirement({
  userId,
  organizationId,
  apiKeyId,
  caip2NetworkLimit,
  evmWalletId,
  paymentRequired,
  preferredNetwork,
  preferredAsset,
}: OutboundX402PaymentParams): Promise<SelectedOutboundX402Payment> {
  const scopeInput: X402ScopeInput = { userId, organizationId };
  const scope = resolveX402TenantScope(scopeInput);
  const accepts = paymentRequired.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw createHttpError(
      400,
      "x402 paymentRequired.accepts must list at least one payment requirement",
    );
  }

  const candidates = accepts.filter((requirement) => {
    if (requirement.scheme !== EXACT_SCHEME) return false;
    if (!/^\d+$/.test(requirement.amount) || BigInt(requirement.amount) <= 0n)
      return false;
    if (!/^eip155:\d+$/.test(requirement.network)) return false;
    if (!isAllowedCaip2Network(caip2NetworkLimit, requirement.network))
      return false;
    if (preferredNetwork != null && requirement.network !== preferredNetwork)
      return false;
    if (
      preferredAsset != null &&
      normalizeAddress(requirement.asset) !== normalizeAddress(preferredAsset)
    ) {
      return false;
    }
    return true;
  });
  if (candidates.length === 0) {
    throw createHttpError(
      400,
      "No forwarded x402 requirement matches an allowed network/asset for this API key",
    );
  }

  let selectedRequirement: PaymentRequirements | null = null;
  let selectedNetworkUserId: string | null = null;
  let selectedX402NetworkId: string | null = null;
  for (const candidate of candidates) {
    const candidateNetwork = await prisma.x402Network.findFirst({
      where: {
        ...networkOwnershipWhere(scope),
        caip2Id: candidate.network,
      },
      select: { isEnabled: true, userId: true, id: true },
    });
    if (candidateNetwork == null || !candidateNetwork.isEnabled) continue;

    const budget = await prisma.x402WalletBudget.findFirst({
      where: {
        apiKeyId,
        evmWalletId,
        caip2Network: candidate.network,
        asset: normalizeAddress(candidate.asset),
        enabled: true,
        remainingAmount: { gte: BigInt(candidate.amount) },
      },
      select: { id: true },
    });
    if (budget == null) continue;

    selectedRequirement = candidate;
    selectedNetworkUserId = candidateNetwork.userId;
    selectedX402NetworkId = candidateNetwork.id;
    break;
  }
  if (
    selectedRequirement == null ||
    selectedNetworkUserId == null ||
    selectedX402NetworkId == null
  ) {
    throw createHttpError(
      402,
      "No managed wallet budget can cover the forwarded x402 payment requirements",
    );
  }

  const wallet = await getManagedWalletOrThrow(
    scopeInput,
    evmWalletId,
    X402EvmWalletType.Purchasing,
  );
  const payer = normalizeAddress(wallet.address);

  return {
    scopeInput,
    selected: selectedRequirement,
    selectedX402NetworkId,
    selectedNetworkUserId,
    payer,
  };
}

async function selectAndReserveOutboundX402Payment(
  params: OutboundX402PaymentParams,
): Promise<
  SelectedOutboundX402Payment & {
    reservation: Awaited<ReturnType<typeof reserveBudgetForAttempt>>;
  }
> {
  const prepared = await selectOutboundX402Requirement(params);
  const reservation = await reserveBudgetForAttempt({
    x402NetworkId: prepared.selectedX402NetworkId,
    networkUserId: prepared.selectedNetworkUserId,
    apiKeyId: params.apiKeyId,
    evmWalletId: params.evmWalletId,
    requirements: prepared.selected,
    payer: prepared.payer,
  });
  return { ...prepared, reservation };
}

export type X402PaymentNodePayResult = {
  payer: string;
  caip2Network: string;
  asset: string;
  amount: string;
  payTo: string;
  xPaymentHeader: string;
  paymentPayload: unknown;
  paymentPayloadHash: string;
  paymentIdentifier: string | null;
};

export async function createX402PaymentViaPaymentNode({
  userId,
  organizationId,
  apiKeyId,
  caip2NetworkLimit,
  evmWalletId,
  paymentRequired,
  preferredNetwork,
  preferredAsset,
  paymentIdentifier: _paymentIdentifier,
  payOnPaymentNode,
}: OutboundX402PaymentParams & {
  paymentIdentifier?: string;
  payOnPaymentNode: (
    selected: PaymentRequirements,
  ) => Promise<X402PaymentNodePayResult>;
}) {
  const { selected, reservation, payer } =
    await selectAndReserveOutboundX402Payment({
      userId,
      organizationId,
      apiKeyId,
      caip2NetworkLimit,
      evmWalletId,
      paymentRequired,
      preferredNetwork,
      preferredAsset,
    });

  let nodeResult: X402PaymentNodePayResult;
  try {
    nodeResult = await payOnPaymentNode(selected);
  } catch (error) {
    await refundBudgetReservation(reservation);
    await prisma.x402PaymentAttempt
      .update({
        where: { id: reservation.attemptId },
        data: {
          status: X402PaymentStatus.Failed,
          errorReason: "x402_sign_failed",
          errorMessage: "x402 payment signing failed",
        },
      })
      .catch((updateError: unknown) => {
        logger.error(
          "x402 failed to record Failed status after refunding reservation",
          {
            attemptId: reservation.attemptId,
            error: updateError,
          },
        );
      });
    if (createHttpError.isHttpError(error)) {
      throw error;
    }
    if (isHttpStatusCarrier(error)) {
      throw createHttpError(error.status, error.message);
    }
    logger.error("x402 payment-node signing failed", {
      attemptId: reservation.attemptId,
      error,
    });
    throw createHttpError(500, "x402 payment signing failed");
  }

  const paymentPayloadHash =
    nodeResult.paymentPayloadHash ||
    hashX402PaymentPayload(nodeResult.paymentPayload);

  const successResponse = {
    attemptId: reservation.attemptId,
    payer: normalizeAddress(nodeResult.payer || payer),
    caip2Network: selected.network,
    asset: normalizeAddress(selected.asset),
    amount: selected.amount,
    payTo: normalizeAddress(selected.payTo),
    xPaymentHeader: nodeResult.xPaymentHeader,
    paymentPayload: nodeResult.paymentPayload,
    paymentPayloadHash,
    paymentIdentifier: nodeResult.paymentIdentifier,
  };

  const resourceUrl =
    typeof nodeResult.paymentPayload === "object" &&
    nodeResult.paymentPayload != null &&
    "resource" in nodeResult.paymentPayload &&
    typeof (nodeResult.paymentPayload as { resource?: { url?: unknown } })
      .resource?.url === "string"
      ? (nodeResult.paymentPayload as { resource: { url: string } }).resource
          .url
      : null;

  try {
    await prisma.x402PaymentAttempt.update({
      where: { id: reservation.attemptId },
      data: {
        status: X402PaymentStatus.Verified,
        resource: resourceUrl,
        paymentPayloadHash,
        paymentPayload: encryptPaymentPayloadForStorage(
          nodeResult.paymentPayload,
        ),
        paymentIdentifier: nodeResult.paymentIdentifier,
      },
    });
  } catch (error) {
    logger.error(
      "x402 payment signed on payment node but SaaS attempt persistence failed",
      {
        attemptId: reservation.attemptId,
        error,
      },
    );
    await prisma.x402PaymentAttempt
      .update({
        where: { id: reservation.attemptId },
        data: {
          status: X402PaymentStatus.Verified,
          resource: resourceUrl,
          paymentPayloadHash,
          paymentIdentifier: nodeResult.paymentIdentifier,
          errorReason: "x402_record_partial",
          errorMessage:
            "Signed payment returned to client; encrypted audit payload not stored",
        },
      })
      .catch((updateError: unknown) => {
        logger.error(
          "x402 failed to record Verified status after payment-node sign",
          {
            attemptId: reservation.attemptId,
            error: updateError,
          },
        );
      });
  }

  // Budget remains spent; return the signature so callers do not retry and
  // reserve/charge again after a successful payment-node sign.
  return successResponse;
}

export async function createX402Payment({
  userId,
  organizationId,
  apiKeyId,
  caip2NetworkLimit,
  evmWalletId,
  paymentRequired,
  preferredNetwork,
  preferredAsset,
  paymentIdentifier,
}: OutboundX402PaymentParams & {
  paymentIdentifier?: string;
}) {
  const {
    scopeInput,
    selected,
    selectedX402NetworkId,
    selectedNetworkUserId,
    payer: budgetPayer,
  } = await selectOutboundX402Requirement({
    userId,
    organizationId,
    apiKeyId,
    caip2NetworkLimit,
    evmWalletId,
    paymentRequired,
    preferredNetwork,
    preferredAsset,
  });

  const { client, payer } = await getClientForWallet(
    scopeInput,
    evmWalletId,
    selected.network,
  );

  // Pin the client to the single requirement we selected and budgeted for, so the
  // default selector cannot sign a different (e.g. costlier) option from accepts[].
  client.registerPolicy((_version, requirements) => {
    const matching = requirements.filter((option) =>
      requirementsMatch(option, selected),
    );
    if (matching.length === 0) {
      throw createHttpError(
        400,
        "x402 payment requirements changed before signing",
      );
    }
    return matching;
  });

  if (paymentIdentifier != null) {
    client.registerExtension({
      key: PAYMENT_IDENTIFIER,
      enrichPaymentPayload: async (signedPayload, declaredPaymentRequired) => {
        if (declaredPaymentRequired.extensions?.[PAYMENT_IDENTIFIER] == null) {
          return signedPayload;
        }
        return {
          ...signedPayload,
          extensions: appendPaymentIdentifierToExtensions(
            { ...(signedPayload.extensions ?? {}) },
            paymentIdentifier,
          ),
        };
      },
    });
  }

  const reservation = await reserveBudgetForAttempt({
    x402NetworkId: selectedX402NetworkId,
    networkUserId: selectedNetworkUserId,
    apiKeyId,
    evmWalletId,
    requirements: selected,
    payer: budgetPayer,
  });

  try {
    // Local signing only — this service never sends the buyer's request. The agent
    // retries its own request with the returned X-PAYMENT header.
    const paymentPayload = await client.createPaymentPayload(paymentRequired);
    const xPaymentHeader = encodePaymentSignatureHeader(paymentPayload);
    const paymentPayloadHash = hashX402PaymentPayload(paymentPayload);
    const identifier = getPaymentIdentifier(paymentPayload);
    if (identifier.errors.length > 0) {
      throw createHttpError(400, identifier.errors.join("; "));
    }
    // If the caller asked to tag the payment but the forwarded 402 does not declare
    // the payment-identifier extension, surface it rather than silently dropping it.
    if (paymentIdentifier != null && identifier.id == null) {
      throw createHttpError(
        400,
        "The forwarded 402 does not advertise the payment-identifier extension",
      );
    }

    await prisma.x402PaymentAttempt.update({
      where: { id: reservation.attemptId },
      data: {
        status: X402PaymentStatus.Verified,
        resource: paymentPayload.resource?.url,
        paymentPayloadHash,
        paymentPayload: encryptPaymentPayloadForStorage(paymentPayload),
        paymentIdentifier: identifier.id,
      },
    });

    return {
      attemptId: reservation.attemptId,
      payer,
      caip2Network: selected.network,
      asset: normalizeAddress(selected.asset),
      amount: selected.amount,
      payTo: normalizeAddress(selected.payTo),
      xPaymentHeader,
      paymentPayload,
      paymentPayloadHash,
      paymentIdentifier: identifier.id,
    };
  } catch (error) {
    // Refund first so that a failure to record the Failed status can never leak the
    // reserved budget; the status update is best-effort and must not mask the error.
    await refundBudgetReservation(reservation);
    await prisma.x402PaymentAttempt
      .update({
        where: { id: reservation.attemptId },
        data: {
          status: X402PaymentStatus.Failed,
          errorReason: "x402_sign_failed",
          // Generic, user-safe message only. The raw error (which can embed the
          // configured RPC URL / request internals) is re-thrown below and logged
          // server-side by the route's error handler — it is never persisted here.
          errorMessage: "x402 payment signing failed",
        },
      })
      .catch((updateError: unknown) => {
        logger.error(
          "x402 failed to record Failed status after refunding reservation",
          {
            attemptId: reservation.attemptId,
            error: updateError,
          },
        );
      });
    // Intentional HttpErrors (e.g. a 400 validation reject thrown above) carry a
    // safe, deliberate message and status — propagate them unchanged. Only unexpected
    // errors (raw signing/RPC failures, which can embed the configured RPC URL) are
    // sanitized so those internals can never reach the caller.
    if (createHttpError.isHttpError(error)) {
      throw error;
    }
    logger.error("x402 payment signing failed", {
      attemptId: reservation.attemptId,
      error,
    });
    throw createHttpError(500, "x402 payment signing failed");
  }
}
