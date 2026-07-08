import "server-only";

import { X402EvmWalletType } from "@masumi/database";
import prisma from "@masumi/database/client";
import type { X402ScopeInput } from "@masumi/payment-source-x402/tenant-scope";
import {
  activeWalletWhere,
  resolveX402TenantScope,
  walletOwnershipWhere,
} from "@masumi/payment-source-x402/tenant-scope";
import createHttpError from "http-errors";

import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { paymentNodeX402WalletSchema } from "@/lib/payment-node/x402-schemas";

const WALLET_OUTPUT_SELECT = {
  id: true,
  address: true,
  type: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  paymentNodeWalletId: true,
} as const;

function defaultWalletNote(type: X402EvmWalletType): string {
  return type === X402EvmWalletType.Purchasing
    ? "Purchasing wallet"
    : "Facilitator wallet";
}

function resolveWalletNote(
  type: X402EvmWalletType,
  note?: string | null,
): string {
  const trimmed = note?.trim();
  return trimmed ? trimmed : defaultWalletNote(type);
}

async function assertTenantWalletSlotAvailable(
  scope: ReturnType<typeof resolveX402TenantScope>,
  type: X402EvmWalletType,
): Promise<void> {
  const existing = await prisma.x402EvmWallet.findFirst({
    where: { ...walletOwnershipWhere(scope), type },
    select: { id: true },
  });
  if (existing != null) {
    throw createHttpError(
      409,
      `This workspace already has a ${type === X402EvmWalletType.Purchasing ? "Purchasing" : "Selling"} wallet. Retire it before creating another.`,
    );
  }
}

async function deletePendingWalletsForType(
  scope: ReturnType<typeof resolveX402TenantScope>,
  type: X402EvmWalletType,
): Promise<void> {
  await prisma.x402EvmWallet.deleteMany({
    where: {
      ...walletOwnershipWhere(scope),
      type,
      backupConfirmedAt: null,
    },
  });
}

/** Create wallet on payment node and persist tenant metadata + reference in SaaS DB. */
export async function createX402WalletOnPaymentNode({
  userId,
  organizationId,
  createdByUserId,
  type,
  note,
  privateKey,
}: {
  userId: string;
  organizationId?: string | null;
  createdByUserId?: string | null;
  type: X402EvmWalletType;
  note?: string | null;
  privateKey?: string;
}) {
  const client = await getPaymentNodeClientForUser(userId);
  if (client == null) {
    throw createHttpError(503, "Payment node not configured for user");
  }

  const scope = resolveX402TenantScope({ userId, organizationId });
  await deletePendingWalletsForType(scope, type);
  await assertTenantWalletSlotAvailable(scope, type);

  const pnWallet = paymentNodeX402WalletSchema.parse(
    await client.createX402Wallet({
      type,
      note: resolveWalletNote(type, note),
      privateKey,
    }),
  );

  const wasGenerated = privateKey == null;
  const backupConfirmedAt = wasGenerated ? null : new Date();

  try {
    const created = await prisma.x402EvmWallet.create({
      data: {
        userId,
        organizationId: organizationId ?? null,
        address: pnWallet.address,
        type,
        note: resolveWalletNote(type, note),
        paymentNodeWalletId: pnWallet.id,
        encryptedPrivateKey: null,
        backupConfirmedAt,
        createdByUserId: createdByUserId ?? null,
      },
      select: WALLET_OUTPUT_SELECT,
    });
    return {
      ...created,
      privateKey: wasGenerated ? (pnWallet.privateKey ?? null) : null,
    };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw createHttpError(
        409,
        "A managed EVM wallet with this address already exists",
      );
    }
    throw error;
  }
}

export async function getLocalWalletWithPaymentNodeId(
  scope: X402ScopeInput,
  evmWalletId: string,
) {
  const tenantScope = resolveX402TenantScope(scope);
  const wallet = await prisma.x402EvmWallet.findFirst({
    where: {
      id: evmWalletId,
      ...activeWalletWhere(tenantScope),
    },
    select: {
      id: true,
      paymentNodeWalletId: true,
      encryptedPrivateKey: true,
    },
  });
  if (wallet == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }
  return wallet;
}

export function usesPaymentNodeCustody(wallet: {
  paymentNodeWalletId: string | null;
  encryptedPrivateKey: string | null;
}): boolean {
  return (
    wallet.paymentNodeWalletId != null && wallet.encryptedPrivateKey == null
  );
}
