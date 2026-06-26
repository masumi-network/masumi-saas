import {
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentStatus,
} from "@masumi/database";
import prisma from "@masumi/database/client";

import {
  paymentAttemptOwnershipWhere,
  resolveX402TenantScope,
  walletOwnershipWhere,
  type X402ScopeInput,
} from "./tenant-scope.js";

export async function countX402ManagedWallets(
  input: X402ScopeInput & {
    type?: X402EvmWalletType;
  },
) {
  const scope = resolveX402TenantScope(input);
  return prisma.x402EvmWallet.count({
    where: { ...walletOwnershipWhere(scope), type: input.type },
  });
}

export async function countX402PaymentAttempts(
  input: X402ScopeInput & {
    status?: X402PaymentStatus;
    direction?: X402PaymentDirection;
    caip2Network?: string;
  },
) {
  const scope = resolveX402TenantScope(input);
  return prisma.x402PaymentAttempt.count({
    where: {
      ...paymentAttemptOwnershipWhere(scope),
      status: input.status,
      direction: input.direction,
      caip2Network: input.caip2Network,
    },
  });
}

export async function countX402Settlements(
  input: X402ScopeInput & {
    caip2Network?: string;
    success?: boolean;
  },
) {
  const scope = resolveX402TenantScope(input);
  return prisma.x402Settlement.count({
    where: {
      caip2Network: input.caip2Network,
      success: input.success,
      PaymentAttempt: paymentAttemptOwnershipWhere(scope),
    },
  });
}
