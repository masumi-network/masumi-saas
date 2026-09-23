import {
  Prisma,
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentStatus,
} from "@masumi/database";
import prisma from "@masumi/database/client";
import createHttpError from "http-errors";

import {
  assertHexAddress,
  assertSafeRpcUrlResolved,
  getEip155ChainId,
  getManagedWalletOrThrow,
  normalizeAddress,
} from "./internal.js";
import {
  budgetOwnershipWhere,
  networkOwnershipWhere,
  paymentAttemptOwnershipWhere,
  resolveX402TenantScope,
  type X402ScopeInput,
} from "./tenant-scope.js";

export {
  settleX402Payment,
  verifyX402Payment,
  type X402InboundPaymentNodeContext,
} from "./inbound-payments.js";
export {
  createX402Payment,
  createX402PaymentViaPaymentNode,
  type X402PaymentNodePayResult,
} from "./outbound-payments.js";
export { hashX402PaymentPayload } from "./payment-payload.js";

// Wallet CRUD lives in ./wallets; re-exported so existing import sites
// (`@masumi/payment-source-x402`) and the service spec keep one entry point.
export {
  cancelX402PendingWallet,
  confirmX402WalletBackup,
  createX402ManagedWallet,
  deleteX402ManagedWallet,
  getX402ManagedWallet,
  listX402ManagedWallets,
  updateX402ManagedWallet,
} from "./wallets.js";
export async function listX402Networks(
  input: X402ScopeInput & {
    isTestnet?: boolean;
  },
) {
  const scope = resolveX402TenantScope(input);
  const networks = await prisma.x402Network.findMany({
    // Split by environment at the query level: testnet chains belong to the Preprod
    // environment, mainnet chains to Mainnet. Undefined returns every chain.
    where: { ...networkOwnershipWhere(scope), isTestnet: input.isTestnet },
    orderBy: { caip2Id: "asc" },
    select: {
      id: true,
      caip2Id: true,
      displayName: true,
      rpcUrl: true,
      isTestnet: true,
      isEnabled: true,
      defaultAsset: true,
      facilitatorWalletId: true,
      // Denormalize the facilitator address so the UI can label chains
      // without loading the full managed-wallet set to resolve the id.
      FacilitatorWallet: { select: { address: true } },
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return networks.map(({ FacilitatorWallet, ...network }) => ({
    ...network,
    facilitatorWalletAddress: FacilitatorWallet?.address ?? null,
  }));
}

export async function upsertX402Network(
  input: X402ScopeInput & {
    caip2Id: string;
    displayName: string;
    rpcUrl: string;
    isTestnet?: boolean;
    isEnabled?: boolean;
    defaultAsset?: string | null;
    facilitatorWalletId?: string | null;
    createdByUserId?: string | null;
  },
) {
  const scope = resolveX402TenantScope(input);
  getEip155ChainId(input.caip2Id);
  await assertSafeRpcUrlResolved(input.rpcUrl);
  if (input.defaultAsset != null)
    assertHexAddress(input.defaultAsset, "defaultAsset");
  // A facilitator must reference a live Selling wallet. Validating here returns a clear
  // 404/400 (instead of an opaque FK 500) and stops a retired wallet — or a Purchasing
  // wallet — from being wired up as a settlement signer.
  if (input.facilitatorWalletId != null) {
    await getManagedWalletOrThrow(
      input,
      input.facilitatorWalletId,
      X402EvmWalletType.Selling,
    );
  }

  const updateData = {
    displayName: input.displayName,
    rpcUrl: input.rpcUrl,
    isTestnet: input.isTestnet,
    isEnabled: input.isEnabled,
    defaultAsset: input.defaultAsset,
    facilitatorWalletId: input.facilitatorWalletId,
  };
  const select = {
    id: true,
    caip2Id: true,
    displayName: true,
    rpcUrl: true,
    isTestnet: true,
    isEnabled: true,
    defaultAsset: true,
    facilitatorWalletId: true,
    FacilitatorWallet: { select: { address: true } },
    createdByUserId: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.X402NetworkSelect;

  const findWhere =
    scope.mode === "org"
      ? { organizationId: scope.organizationId, caip2Id: input.caip2Id }
      : { userId: scope.userId, caip2Id: input.caip2Id, organizationId: null };
  const createData = {
    userId: scope.mode === "org" ? input.userId : scope.userId,
    organizationId: scope.mode === "org" ? scope.organizationId : null,
    caip2Id: input.caip2Id,
    displayName: input.displayName,
    rpcUrl: input.rpcUrl,
    isTestnet: input.isTestnet ?? false,
    isEnabled: input.isEnabled ?? true,
    defaultAsset: input.defaultAsset,
    facilitatorWalletId: input.facilitatorWalletId,
    createdByUserId: input.createdByUserId,
  };

  const existing = await prisma.x402Network.findFirst({
    where: findWhere,
    select: { id: true },
  });

  let result: Prisma.X402NetworkGetPayload<{ select: typeof select }>;
  if (existing != null) {
    result = await prisma.x402Network.update({
      where: { id: existing.id },
      data: updateData,
      select,
    });
  } else {
    try {
      result = await prisma.x402Network.create({ data: createData, select });
    } catch (error) {
      // Concurrent upsert of the same (tenant, caip2Id) can race between the
      // findFirst above and this create, tripping the partial-unique index
      // (P2002). Recover idempotently as an update instead of surfacing a 500.
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: unknown }).code === "P2002"
      ) {
        const row = await prisma.x402Network.findFirst({
          where: findWhere,
          select: { id: true },
        });
        if (row == null) throw error;
        result = await prisma.x402Network.update({
          where: { id: row.id },
          data: updateData,
          select,
        });
      } else {
        throw error;
      }
    }
  }

  const { FacilitatorWallet, ...network } = result;
  return {
    ...network,
    facilitatorWalletAddress: FacilitatorWallet?.address ?? null,
  };
}

export async function setX402WalletBudget(
  input: X402ScopeInput & {
    apiKeyId: string;
    evmWalletId: string;
    caip2Network: string;
    asset: string;
    remainingAmount: string;
    createdByUserId?: string | null;
  },
) {
  const scope = resolveX402TenantScope(input);
  getEip155ChainId(input.caip2Network);
  assertHexAddress(input.asset, "asset");
  const asset = normalizeAddress(input.asset);
  const remainingAmount = BigInt(input.remainingAmount);

  // Validate the referenced network, api key and wallet up front so a missing one returns
  // a clear 404 instead of an opaque foreign-key 500 from the upsert.
  const [network, apiKey] = await Promise.all([
    prisma.x402Network.findFirst({
      where: {
        ...networkOwnershipWhere(scope),
        caip2Id: input.caip2Network,
      },
      select: { caip2Id: true, userId: true, id: true },
    }),
    prisma.apikey.findFirst({
      where: { id: input.apiKeyId, userId: input.userId },
      select: { id: true },
    }),
  ]);
  if (network == null) {
    throw createHttpError(
      404,
      "x402 network is not registered; add the network before granting a budget",
    );
  }
  if (apiKey == null) {
    throw createHttpError(404, "API key not found");
  }
  // Budgets fund outbound payments, so they may only be granted to a Purchasing wallet.
  await getManagedWalletOrThrow(
    input,
    input.evmWalletId,
    X402EvmWalletType.Purchasing,
  );

  return prisma.x402WalletBudget.upsert({
    where: {
      apiKeyId_evmWalletId_caip2Network_asset: {
        apiKeyId: input.apiKeyId,
        evmWalletId: input.evmWalletId,
        caip2Network: input.caip2Network,
        asset,
      },
    },
    create: {
      userId: network.userId,
      x402NetworkId: network.id,
      apiKeyId: input.apiKeyId,
      evmWalletId: input.evmWalletId,
      caip2Network: input.caip2Network,
      asset,
      remainingAmount,
      spentAmount: 0n,
      createdByUserId: input.createdByUserId,
    },
    // createdById is intentionally not updated — it records who first set the budget.
    // Setting a budget replaces the remaining amount with a fresh grant, so reset
    // spentAmount too; otherwise "remaining + spent" no longer equals what was granted
    // and the Spent column keeps stale consumption from the previous grant.
    update: {
      remainingAmount,
      spentAmount: 0n,
    },
    select: {
      id: true,
      apiKeyId: true,
      evmWalletId: true,
      EvmWallet: { select: { address: true } },
      caip2Network: true,
      asset: true,
      remainingAmount: true,
      spentAmount: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listX402WalletBudgets(
  input: X402ScopeInput & {
    apiKeyId?: string;
  },
) {
  const scope = resolveX402TenantScope(input);
  return prisma.x402WalletBudget.findMany({
    where: {
      ...budgetOwnershipWhere(scope),
      ...(input.apiKeyId != null ? { apiKeyId: input.apiKeyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      apiKeyId: true,
      evmWalletId: true,
      EvmWallet: { select: { address: true } },
      caip2Network: true,
      asset: true,
      remainingAmount: true,
      spentAmount: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteX402WalletBudget(
  scopeInput: X402ScopeInput,
  budgetId: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  // Scoped deleteMany avoids a TOCTOU between an ownership findFirst and a bare
  // delete-by-id: a concurrent delete of the same budget would make the second
  // caller's `delete` throw Prisma P2025 (→ unhandled 500). deleteMany stays
  // tenant-scoped and is idempotent; count === 0 means not found / already gone.
  const deleted = await prisma.x402WalletBudget.deleteMany({
    where: { id: budgetId, ...budgetOwnershipWhere(scope) },
  });
  if (deleted.count === 0) {
    throw createHttpError(404, "x402 wallet budget not found");
  }
  return { budgetId, deletedAt: new Date() };
}

export async function listX402PaymentAttempts(
  input: X402ScopeInput & {
    take: number;
    cursorId?: string;
    status?: X402PaymentStatus;
    direction?: X402PaymentDirection;
    caip2Network?: string;
  },
) {
  const scope = resolveX402TenantScope(input);
  // Explicit projection: never expose paymentPayload or encrypted material to the
  // dashboard.
  return prisma.x402PaymentAttempt.findMany({
    where: {
      ...paymentAttemptOwnershipWhere(scope),
      status: input.status,
      direction: input.direction,
      caip2Network: input.caip2Network,
    },
    orderBy: { createdAt: "desc" },
    take: input.take,
    cursor: input.cursorId ? { id: input.cursorId } : undefined,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      direction: true,
      status: true,
      userId: true,
      apiKeyId: true,
      evmWalletId: true,
      agentId: true,
      supportedPaymentSourceId: true,
      caip2Network: true,
      asset: true,
      amount: true,
      payTo: true,
      payer: true,
      resource: true,
      paymentIdentifier: true,
      errorReason: true,
      errorMessage: true,
      Settlement: {
        select: {
          id: true,
          success: true,
          txHash: true,
          amount: true,
          payer: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function listX402Settlements(
  input: X402ScopeInput & {
    take: number;
    cursorId?: string;
    caip2Network?: string;
  },
) {
  const scope = resolveX402TenantScope(input);
  // Explicit projection: never expose rawResponse to the dashboard.
  return prisma.x402Settlement.findMany({
    where: {
      caip2Network: input.caip2Network,
      PaymentAttempt: paymentAttemptOwnershipWhere(scope),
    },
    orderBy: { createdAt: "desc" },
    take: input.take,
    cursor: input.cursorId ? { id: input.cursorId } : undefined,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      paymentAttemptId: true,
      success: true,
      txHash: true,
      caip2Network: true,
      amount: true,
      payer: true,
    },
  });
}
