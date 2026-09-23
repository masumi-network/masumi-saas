import type { Prisma } from "@masumi/database";

/** Personal workspace uses userId; org workspace shares config by organizationId. */
export type X402TenantScope = { caip2NetworkLimit?: string[] | null } & (
  | { mode: "personal"; userId: string }
  | { mode: "org"; userId: string; organizationId: string }
);

export type X402ScopeInput = {
  userId: string;
  organizationId?: string | null;
  caip2NetworkLimit?: string[] | null;
};

export function resolveX402TenantScope(input: X402ScopeInput): X402TenantScope {
  if (input.organizationId) {
    return {
      ...(input.caip2NetworkLimit != null
        ? { caip2NetworkLimit: input.caip2NetworkLimit }
        : {}),
      mode: "org",
      userId: input.userId,
      organizationId: input.organizationId,
    };
  }
  return {
    mode: "personal",
    userId: input.userId,
    ...(input.caip2NetworkLimit != null
      ? { caip2NetworkLimit: input.caip2NetworkLimit }
      : {}),
  };
}

export function walletOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402EvmWalletWhereInput {
  if (scope.mode === "org") {
    return { organizationId: scope.organizationId, deletedAt: null };
  }
  return { userId: scope.userId, organizationId: null, deletedAt: null };
}

/** Wallets visible in UI and usable for payments after backup is confirmed. */
export function activeWalletWhere(
  scope: X402TenantScope,
): Prisma.X402EvmWalletWhereInput {
  return {
    ...walletOwnershipWhere(scope),
    backupConfirmedAt: { not: null },
  };
}

function networkConstraint(
  scope: X402TenantScope,
  field: "caip2Id" | "caip2Network",
) {
  return scope.caip2NetworkLimit == null
    ? {}
    : { AND: [{ [field]: { in: scope.caip2NetworkLimit } }] };
}

export function networkOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402NetworkWhereInput {
  return {
    ...(scope.mode === "org"
      ? { organizationId: scope.organizationId }
      : { userId: scope.userId, organizationId: null }),
    ...networkConstraint(scope, "caip2Id"),
  };
}

export function paymentAttemptOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402PaymentAttemptWhereInput {
  return {
    ...(scope.mode === "org"
      ? { Network: { organizationId: scope.organizationId } }
      : { userId: scope.userId, Network: { organizationId: null } }),
    ...networkConstraint(scope, "caip2Network"),
  };
}

export function budgetOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402WalletBudgetWhereInput {
  return {
    ...(scope.mode === "org"
      ? { EvmWallet: { organizationId: scope.organizationId } }
      : { userId: scope.userId, EvmWallet: { organizationId: null } }),
    ...networkConstraint(scope, "caip2Network"),
  };
}

export function lowBalanceRuleOwnershipWhere(
  scope: X402TenantScope,
): Prisma.X402EvmWalletLowBalanceRuleWhereInput {
  return {
    EvmWallet: walletOwnershipWhere(scope),
    ...networkConstraint(scope, "caip2Network"),
  };
}
