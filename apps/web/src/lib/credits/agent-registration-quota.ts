import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { CREDIT_COST, INITIAL_CREDIT_GRANT } from "./constants";

/** Default grant for new accounts (see {@link INITIAL_CREDIT_GRANT}). */
export const TYPICAL_INITIAL_REGISTRATION_QUOTA = INITIAL_CREDIT_GRANT;

/**
 * Max agents a user can start in one batch on the given network, bounded by
 * SaaS credits on Mainnet (1 credit per registration) and the caller's hard cap.
 */
export function maxAgentRegistrationsForBalance(params: {
  network: PaymentNodeNetwork;
  creditsRemaining: number;
  maxPerBatch: number;
}): number {
  const { network, creditsRemaining, maxPerBatch } = params;
  if (maxPerBatch <= 0) return 0;

  if (network !== "Mainnet") {
    return maxPerBatch;
  }

  const affordable = Math.floor(Math.max(0, creditsRemaining) / CREDIT_COST);
  return Math.min(maxPerBatch, affordable);
}

export function creditsRequiredForRegistrations(count: number): number {
  if (count <= 0) return 0;
  return count * CREDIT_COST;
}
