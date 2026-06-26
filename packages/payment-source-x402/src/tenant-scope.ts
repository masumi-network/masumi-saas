import type { Prisma } from "@masumi/database";

/** Personal workspace uses userId; org workspace shares config by organizationId. */
export type X402TenantScope =
  | { mode: "personal"; userId: string }
  | { mode: "org"; userId: string; organizationId: string };

export type X402ScopeInput = {
  userId: string;
  organizationId?: string | null;
};

export function resolveX402TenantScope(input: X402ScopeInput): X402TenantScope {
  if (input.organizationId) {
    return {
      mode: "org",
      userId: input.userId,
      organizationId: input.organizationId,
    };
  }
  return { mode: "personal", userId: input.userId };
}

export function walletOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402EvmWalletWhereInput {
  if (scope.mode === "org") {
    return { organizationId: scope.organizationId, deletedAt: null };
  }
  return { userId: scope.userId, organizationId: null, deletedAt: null };
}

export function networkOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402NetworkWhereInput {
  if (scope.mode === "org") {
    return { organizationId: scope.organizationId };
  }
  return { userId: scope.userId, organizationId: null };
}

export function paymentAttemptOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402PaymentAttemptWhereInput {
  if (scope.mode === "org") {
    return { Network: { organizationId: scope.organizationId } };
  }
  return {
    userId: scope.userId,
    Network: { organizationId: null },
  };
}

export function budgetOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402WalletBudgetWhereInput {
  if (scope.mode === "org") {
    return { EvmWallet: { organizationId: scope.organizationId } };
  }
  return {
    userId: scope.userId,
    EvmWallet: { organizationId: null },
  };
}

export function lowBalanceRuleOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402EvmWalletLowBalanceRuleWhereInput {
  return { EvmWallet: walletOwnershipWhere(scope) };
}
