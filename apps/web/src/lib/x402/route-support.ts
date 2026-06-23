import {
  BASE_MAINNET_CAIP2,
  BASE_SEPOLIA_CAIP2,
  CARDANO_MAINNET_CAIP2,
  CARDANO_PREPROD_CAIP2,
} from "@masumi/payment-source-x402";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
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

export function requireX402PayAccess(
  authContext: AuthenticatedApiContext,
): void {
  requireAnyNetworkedOidcApiScope(authContext, {
    resource: "payments",
    action: "write",
  });
}

export function requireX402AdminRead(
  authContext: AuthenticatedApiContext,
): void {
  requireAnyNetworkedOidcApiScope(authContext, {
    resource: "payments",
    action: "read",
  });
}

export function requireX402AdminWrite(
  authContext: AuthenticatedApiContext,
): void {
  requireAnyNetworkedOidcApiScope(authContext, {
    resource: "payments",
    action: "write",
  });
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

export function serializeBudget(budget: {
  id: string;
  orgApiKeyId: string;
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
  };
}

export function serializePaymentAttempt(attempt: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  direction: string;
  status: string;
  userId: string;
  orgApiKeyId: string | null;
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
    Settlement: attempt.Settlement
      ? {
          ...attempt.Settlement,
          amount: attempt.Settlement.amount?.toString() ?? null,
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
  };
}
