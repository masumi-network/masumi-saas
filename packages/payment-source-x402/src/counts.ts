import {
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentStatus,
} from "@masumi/database";
import prisma from "@masumi/database/client";

export async function countX402ManagedWallets(input: {
  userId: string;
  type?: X402EvmWalletType;
}) {
  return prisma.x402EvmWallet.count({
    where: { userId: input.userId, deletedAt: null, type: input.type },
  });
}

export async function countX402PaymentAttempts(input: {
  userId: string;
  status?: X402PaymentStatus;
  direction?: X402PaymentDirection;
  caip2Network?: string;
}) {
  return prisma.x402PaymentAttempt.count({
    where: {
      userId: input.userId,
      status: input.status,
      direction: input.direction,
      caip2Network: input.caip2Network,
    },
  });
}

export async function countX402Settlements(input: {
  userId: string;
  caip2Network?: string;
  success?: boolean;
}) {
  return prisma.x402Settlement.count({
    where: {
      caip2Network: input.caip2Network,
      success: input.success,
      PaymentAttempt: { userId: input.userId },
    },
  });
}
