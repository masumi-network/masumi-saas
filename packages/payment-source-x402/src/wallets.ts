import { Prisma, X402EvmWalletType } from "@masumi/database";
import prisma from "@masumi/database/client";
import createHttpError from "http-errors";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { encrypt } from "./encryption.js";
import { assertValidPrivateKey } from "./internal.js";
import {
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
} satisfies Prisma.X402EvmWalletSelect;

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
  const wasGenerated = privateKey == null;
  const walletPrivateKey = privateKey ?? generatePrivateKey();
  assertValidPrivateKey(walletPrivateKey);
  const account = privateKeyToAccount(walletPrivateKey);

  try {
    const created = await prisma.x402EvmWallet.create({
      data: {
        userId,
        organizationId: organizationId ?? null,
        address: account.address,
        type,
        note: note ?? null,
        encryptedPrivateKey: encrypt(walletPrivateKey),
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
      throw createHttpError(
        409,
        "A managed EVM wallet with this address already exists",
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
    where: { ...walletOwnershipWhere(scope), type: input.type },
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
    where: { id: evmWalletId, ...walletOwnershipWhere(scope) },
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
    where: { id: input.id, ...walletOwnershipWhere(scope) },
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
    where: { id: evmWalletId, ...walletOwnershipWhere(scope) },
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
