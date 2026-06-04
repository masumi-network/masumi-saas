import "server-only";

import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { ApiError, isAuthOrCreditsError } from "@/server/hono/errors";

import { type CreditChargeReason, getCreditCostForReason } from "./pricing";
import {
  consumeCreditIfRequired,
  type CreditBalance,
  refundConsumedCredit,
} from "./service";

type CreditMetadata = Record<string, unknown>;

function shouldRefundAfterThrownError(error: unknown): boolean {
  if (isAuthOrCreditsError(error)) return false;
  if (isPaymentNodeConfigError(error)) return false;
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  return true;
}

/**
 * Debits credits on Mainnet, runs `run`, and refunds when the operation fails
 * (non-ApiError throws, or ApiError with status >= 500).
 */
export async function withCreditCharge<T>(params: {
  userId: string;
  reason: CreditChargeReason;
  reference: string;
  network?: string | null | undefined;
  metadata?: CreditMetadata;
  run: () => Promise<T>;
}): Promise<T> {
  try {
    await consumeCreditIfRequired({
      userId: params.userId,
      reason: params.reason,
      reference: params.reference,
      network: params.network,
      metadata: params.metadata,
    });
    return await params.run();
  } catch (error) {
    if (shouldRefundAfterThrownError(error)) {
      await refundConsumedCredit({
        userId: params.userId,
        reason: params.reason,
        reference: params.reference,
        network: params.network,
        metadata: params.metadata,
      });
    }
    throw error;
  }
}

export type { CreditBalance, CreditChargeReason, CreditMetadata };

export { getCreditCostForReason };
