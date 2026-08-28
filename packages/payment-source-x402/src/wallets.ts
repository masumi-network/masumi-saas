import { Prisma, X402EvmWalletType } from "@masumi/database";
import prisma from "@masumi/database/client";
import createHttpError from "http-errors";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { encrypt } from "./encryption.js";
import { assertValidPrivateKey } from "./internal.js";
import {
  activeWalletWhere,
  networkOwnershipWhere,
  resolveX402TenantScope,
  walletOwnershipWhere,
  type X402ScopeInput,
} from "./tenant-scope.js";

const WALLET_OUTPUT_SELECT = {
  id: true,
  address: true,
  type: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  paymentNodeWalletId: true,
  paymentNodeNetworkId: true,
  caip2Network: true,
} satisfies Prisma.X402EvmWalletSelect;

function walletTypeLabel(type: X402EvmWalletType): string {
  return type === X402EvmWalletType.Purchasing ? "Purchasing" : "Selling";
}

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
      `This workspace already has a ${walletTypeLabel(type)} wallet. Retire it before creating another.`,
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
    select: { id: true, backupConfirmedAt: true },
  });
}

export async function createX402ManagedWallet({
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
  const scope = resolveX402TenantScope({ userId, organizationId });
  await deletePendingWalletsForType(scope, type);
  await assertTenantWalletSlotAvailable(scope, type);

  const wasGenerated = privateKey == null;
  const walletPrivateKey = privateKey ?? generatePrivateKey();
  assertValidPrivateKey(walletPrivateKey);
  const account = privateKeyToAccount(walletPrivateKey);
  const backupConfirmedAt = wasGenerated ? null : new Date();

  try {
    const created = await prisma.x402EvmWallet.create({
      data: {
        userId,
        organizationId: organizationId ?? null,
        address: account.address,
        type,
        note: resolveWalletNote(type, note),
        encryptedPrivateKey: encrypt(walletPrivateKey),
        backupConfirmedAt,
        createdByUserId: createdByUserId ?? null,
      },
      select: WALLET_OUTPUT_SELECT,
    });
    return { ...created, privateKey: wasGenerated ? walletPrivateKey : null };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const target = (error as { meta?: { target?: string[] } }).meta?.target;
      if (Array.isArray(target) && target.includes("address")) {
        throw createHttpError(
          409,
          "A managed EVM wallet with this address already exists",
        );
      }
      throw createHttpError(
        409,
        `This workspace already has a ${walletTypeLabel(type)} wallet. Retire it before creating another.`,
      );
    }
    throw error;
  }
}

export async function listX402ManagedWallets(
  input: X402ScopeInput & {
    take?: number;
    cursorId?: string;
    type?: X402EvmWalletType;
  },
) {
  const scope = resolveX402TenantScope(input);
  return prisma.x402EvmWallet.findMany({
    where: {
      ...activeWalletWhere(scope),
      ...(input.type != null ? { type: input.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.take,
    cursor: input.cursorId ? { id: input.cursorId } : undefined,
    select: WALLET_OUTPUT_SELECT,
  });
}

export async function getX402ManagedWallet(
  scopeInput: X402ScopeInput,
  evmWalletId: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const wallet = await prisma.x402EvmWallet.findFirst({
    where: { id: evmWalletId, ...activeWalletWhere(scope) },
    select: WALLET_OUTPUT_SELECT,
  });
  if (wallet == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }
  return wallet;
}

export async function updateX402ManagedWallet(
  input: X402ScopeInput & {
    id: string;
    note?: string | null;
  },
) {
  const scope = resolveX402TenantScope(input);
  const existing = await prisma.x402EvmWallet.findFirst({
    where: { id: input.id, ...activeWalletWhere(scope) },
    select: { id: true },
  });
  if (existing == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }
  return prisma.x402EvmWallet.update({
    where: { id: input.id },
    data: { note: input.note ?? null },
    select: WALLET_OUTPUT_SELECT,
  });
}

export async function deleteX402ManagedWallet(
  scopeInput: X402ScopeInput,
  evmWalletId: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const wallet = await prisma.x402EvmWallet.findFirst({
    where: { id: evmWalletId, ...activeWalletWhere(scope) },
    select: { id: true },
  });
  if (wallet == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }

  await prisma.$transaction([
    prisma.x402EvmWallet.update({
      where: { id: evmWalletId },
      data: { deletedAt: new Date() },
    }),
    prisma.x402WalletBudget.updateMany({
      where: { evmWalletId },
      data: { enabled: false },
    }),
    prisma.x402EvmWalletLowBalanceRule.updateMany({
      where: { evmWalletId },
      data: { enabled: false },
    }),
    prisma.x402Network.updateMany({
      where: {
        ...networkOwnershipWhere(scope),
        facilitatorWalletId: evmWalletId,
      },
      data: { facilitatorWalletId: null },
    }),
  ]);

  return { id: evmWalletId };
}

export async function confirmX402WalletBackup(
  scopeInput: X402ScopeInput,
  evmWalletId: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const wallet = await findOwnedWalletRecord(scope, evmWalletId, {
    includePending: true,
  });
  if (wallet == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }
  if (wallet.backupConfirmedAt != null) {
    throw createHttpError(409, "Wallet backup is already confirmed");
  }

  return prisma.x402EvmWallet.update({
    where: { id: evmWalletId },
    data: { backupConfirmedAt: new Date() },
    select: WALLET_OUTPUT_SELECT,
  });
}

export async function cancelX402PendingWallet(
  scopeInput: X402ScopeInput,
  evmWalletId: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const wallet = await findOwnedWalletRecord(scope, evmWalletId, {
    includePending: true,
  });
  if (wallet == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }
  if (wallet.backupConfirmedAt != null) {
    throw createHttpError(409, "Only pending wallets can be cancelled");
  }

  await prisma.x402EvmWallet.delete({ where: { id: evmWalletId } });
  return { id: evmWalletId };
}
