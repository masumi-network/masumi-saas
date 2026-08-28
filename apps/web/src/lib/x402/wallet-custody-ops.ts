import "server-only";

import prisma from "@masumi/database/client";
import {
  activeWalletWhere,
  cancelX402PendingWallet,
  deleteX402ManagedWallet,
  resolveX402TenantScope,
  updateX402ManagedWallet,
  walletOwnershipWhere,
  type X402ScopeInput,
} from "@masumi/payment-source-x402";

import { rethrowPaymentNodeClientError } from "@/lib/payment-node/errors";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { ApiError } from "@/server/hono/errors";

import {
  extractCaip2FromPayInput,
  resolvePaymentNodeWalletIdForCaip2,
} from "./payment-node-wallet-network";
import {
  getLocalWalletWithPaymentNodeId,
  usesPaymentNodeCustody,
} from "./wallet-custody";

async function findOwnedWalletRecord(
  scope: ReturnType<typeof resolveX402TenantScope>,
  evmWalletId: string,
  options?: { includePending?: boolean },
) {
  return prisma.x402EvmWallet.findFirst({
    where: {
      id: evmWalletId,
      ...(options?.includePending
        ? walletOwnershipWhere(scope)
        : activeWalletWhere(scope)),
    },
    select: {
      id: true,
      paymentNodeWalletId: true,
      encryptedPrivateKey: true,
      backupConfirmedAt: true,
    },
  });
}

async function deletePaymentNodeWalletIfCustodied(
  userId: string,
  wallet: {
    paymentNodeWalletId: string | null;
    encryptedPrivateKey: string | null;
  },
): Promise<void> {
  if (!usesPaymentNodeCustody(wallet) || wallet.paymentNodeWalletId == null) {
    return;
  }
  const client = await getPaymentNodeClientForUser(userId);
  if (client == null) {
    throw new ApiError(503, "Payment node not configured for user");
  }
  await client.deleteX402Wallet({ id: wallet.paymentNodeWalletId });
}

export async function updateX402WalletWithCustody(
  userId: string,
  input: X402ScopeInput & { id: string; note?: string | null },
) {
  const wallet = await getLocalWalletWithPaymentNodeId(input, input.id);
  if (usesPaymentNodeCustody(wallet) && wallet.paymentNodeWalletId != null) {
    const client = await getPaymentNodeClientForUser(userId);
    if (client == null) {
      throw new ApiError(503, "Payment node not configured for user");
    }
    await client.updateX402Wallet({
      id: wallet.paymentNodeWalletId,
      note: input.note,
    });
  }
  return updateX402ManagedWallet(input);
}

export async function deleteX402WalletWithCustody(
  userId: string,
  scopeInput: X402ScopeInput,
  evmWalletId: string,
) {
  const wallet = await getLocalWalletWithPaymentNodeId(scopeInput, evmWalletId);
  await deletePaymentNodeWalletIfCustodied(userId, wallet);
  return deleteX402ManagedWallet(scopeInput, evmWalletId);
}

export async function cancelX402PendingWalletWithCustody(
  userId: string,
  scopeInput: X402ScopeInput,
  evmWalletId: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const wallet = await findOwnedWalletRecord(scope, evmWalletId, {
    includePending: true,
  });
  if (wallet == null) {
    throw new ApiError(404, "Managed EVM wallet not found");
  }
  await deletePaymentNodeWalletIfCustodied(userId, wallet);
  return cancelX402PendingWallet(scopeInput, evmWalletId);
}

export async function proxyCreateX402PaymentIfCustodied(
  userId: string,
  scopeInput: X402ScopeInput,
  input: {
    evmWalletId: string;
    paymentRequired: unknown;
    preferredNetwork?: string;
    preferredAsset?: string;
    paymentIdentifier?: string;
  },
) {
  const wallet = await getLocalWalletWithPaymentNodeId(
    scopeInput,
    input.evmWalletId,
  );
  if (!usesPaymentNodeCustody(wallet)) {
    return null;
  }
  const client = await getPaymentNodeClientForUser(userId);
  if (client == null) {
    throw new ApiError(503, "Payment node not configured for user");
  }

  const tenantScope = resolveX402TenantScope(scopeInput);
  const walletRecord = await prisma.x402EvmWallet.findFirst({
    where: {
      id: input.evmWalletId,
      ...activeWalletWhere(tenantScope),
    },
    select: {
      address: true,
      type: true,
      paymentNodeWalletId: true,
    },
  });
  if (walletRecord?.paymentNodeWalletId == null) {
    throw new ApiError(404, "Managed EVM wallet not found");
  }

  const caip2Network = extractCaip2FromPayInput(input);
  let paymentNodeWalletId = walletRecord.paymentNodeWalletId;
  if (caip2Network != null) {
    paymentNodeWalletId = await resolvePaymentNodeWalletIdForCaip2(client, {
      paymentNodeWalletId: walletRecord.paymentNodeWalletId,
      address: walletRecord.address,
      type: walletRecord.type === "Purchasing" ? "Purchasing" : "Selling",
      caip2Network,
    });
  }

  try {
    return await client.createX402Payment({
      evmWalletId: paymentNodeWalletId,
      paymentRequired: input.paymentRequired,
      preferredNetwork: input.preferredNetwork,
      preferredAsset: input.preferredAsset,
      paymentIdentifier: input.paymentIdentifier,
    });
  } catch (error) {
    rethrowPaymentNodeClientError(error);
  }
}
