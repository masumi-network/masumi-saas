import {
  LowBalanceStatus,
  X402PaymentDirection,
  X402PaymentStatus,
} from "@masumi/database";
import {
  BASE_MAINNET_CAIP2,
  BASE_SEPOLIA_CAIP2,
  CARDANO_MAINNET_CAIP2,
  CARDANO_PREPROD_CAIP2,
} from "@masumi/payment-source-x402";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import {
  requireX402SessionAccess,
  requireX402SessionBudgetAccess,
  requireX402SessionBudgetReadAccess,
} from "@/lib/auth/org-admin";
import { type AuthenticatedApiContext } from "@/lib/auth/utils";
import { buildNetworkedOidcScope } from "@/lib/config/oidc-scopes.config";
import { ApiError } from "@/server/hono/errors";

export function rethrowIfHttpError(err: unknown): void {
  if (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { statusCode?: unknown }).statusCode === "number" &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    const httpErr = err as { statusCode: number; message: string };
    throw new ApiError(
      httpErr.statusCode as ContentfulStatusCode,
      httpErr.message,
    );
  }
}

export async function requireX402PayAccess(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "write",
    });
    return;
  }

  await requireX402SessionAccess(authContext);
}

export async function requireX402AdminRead(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "read",
    });
    return;
  }

  await requireX402SessionAccess(authContext);
}

export async function requireX402AdminWrite(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "write",
    });
    return;
  }

  await requireX402SessionAccess(authContext);
}

export async function requireX402BudgetRead(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "read",
    });
    return;
  }

  await requireX402SessionBudgetReadAccess(authContext);
}

export async function requireX402BudgetWrite(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "write",
    });
    return;
  }

  await requireX402SessionBudgetAccess(authContext);
}

export function getCaip2NetworkLimitFromAuth(
  authContext: AuthenticatedApiContext,
): string[] | null {
  if (authContext.authMethod !== "oidcAccessToken") {
    return null;
  }

  const scopes = authContext.oidcScopes;
  const hasPreprod = scopes.includes(
    buildNetworkedOidcScope("payments", "write", "preprod"),
  );
  const hasMainnet = scopes.includes(
    buildNetworkedOidcScope("payments", "write", "mainnet"),
  );
  const hasPreprodRead = scopes.includes(
    buildNetworkedOidcScope("payments", "read", "preprod"),
  );
  const hasMainnetRead = scopes.includes(
    buildNetworkedOidcScope("payments", "read", "mainnet"),
  );

  const allowPreprod = hasPreprod || hasPreprodRead;
  const allowMainnet = hasMainnet || hasMainnetRead;

  if (allowPreprod && allowMainnet) {
    return null;
  }

  const limits: string[] = [];
  if (allowPreprod) {
    limits.push(CARDANO_PREPROD_CAIP2, BASE_SEPOLIA_CAIP2);
  }
  if (allowMainnet) {
    limits.push(CARDANO_MAINNET_CAIP2, BASE_MAINNET_CAIP2);
  }

  return limits.length > 0 ? limits : null;
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

export function serializeWallet<
  T extends {
    id: string;
    address: string;
    type: string;
    note: string | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    privateKey?: string | null;
  },
>(wallet: T) {
  return {
    ...wallet,
    createdAt: toIsoString(wallet.createdAt),
    updatedAt: toIsoString(wallet.updatedAt),
  };
}

export function serializeNetwork<
  T extends {
    createdAt: Date;
    updatedAt: Date;
  },
>(network: T) {
  return {
    ...network,
    createdAt: toIsoString(network.createdAt),
    updatedAt: toIsoString(network.updatedAt),
  };
}

export function serializeBudget(budget: {
  id: string;
  apiKeyId: string;
  evmWalletId: string;
  EvmWallet: { address: string };
  caip2Network: string;
  asset: string;
  remainingAmount: bigint;
  spentAmount: bigint;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { EvmWallet, ...rest } = budget;
  return {
    ...rest,
    evmWalletAddress: EvmWallet.address,
    remainingAmount: budget.remainingAmount.toString(),
    spentAmount: budget.spentAmount.toString(),
    createdAt: toIsoString(budget.createdAt),
    updatedAt: toIsoString(budget.updatedAt),
  };
}

export function serializePaymentAttempt(attempt: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  direction: X402PaymentDirection;
  status: X402PaymentStatus;
  userId: string;
  apiKeyId: string | null;
  evmWalletId: string | null;
  agentId: string | null;
  supportedPaymentSourceId: string | null;
  caip2Network: string;
  asset: string;
  amount: bigint;
  payTo: string;
  payer: string | null;
  resource: string | null;
  paymentIdentifier: string | null;
  errorReason: string | null;
  errorMessage: string | null;
  Settlement: {
    id: string;
    success: boolean;
    txHash: string | null;
    amount: bigint | null;
    payer: string | null;
    createdAt: Date;
  } | null;
}) {
  return {
    ...attempt,
    amount: attempt.amount.toString(),
    createdAt: toIsoString(attempt.createdAt),
    updatedAt: toIsoString(attempt.updatedAt),
    Settlement: attempt.Settlement
      ? {
          ...attempt.Settlement,
          amount: attempt.Settlement.amount?.toString() ?? null,
          createdAt: toIsoString(attempt.Settlement.createdAt),
        }
      : null,
  };
}

export function serializeSettlement(settlement: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  paymentAttemptId: string;
  success: boolean;
  txHash: string | null;
  caip2Network: string;
  amount: bigint | null;
  payer: string | null;
}) {
  return {
    ...settlement,
    amount: settlement.amount?.toString() ?? null,
    createdAt: toIsoString(settlement.createdAt),
    updatedAt: toIsoString(settlement.updatedAt),
  };
}

export function serializeLowBalanceRule(rule: {
  id: string;
  evmWalletId: string;
  EvmWallet: { address: string };
  caip2Network: string;
  asset: string;
  thresholdAmount: bigint;
  enabled: boolean;
  status: LowBalanceStatus;
  lastKnownAmount: bigint | null;
  lastCheckedAt: Date | null;
  lastAlertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { EvmWallet, ...rest } = rule;
  return {
    ...rest,
    evmWalletAddress: EvmWallet.address,
    thresholdAmount: rule.thresholdAmount.toString(),
    lastKnownAmount: rule.lastKnownAmount?.toString() ?? null,
    lastCheckedAt: rule.lastCheckedAt ? toIsoString(rule.lastCheckedAt) : null,
    lastAlertedAt: rule.lastAlertedAt ? toIsoString(rule.lastAlertedAt) : null,
    createdAt: toIsoString(rule.createdAt),
    updatedAt: toIsoString(rule.updatedAt),
  };
}
