export type CreditLedgerReason =
  | "initial_grant"
  | "agent_register"
  | "inbox_agent_register"
  | "payment_proxy_write";

/**
 * Atomic ledger units for one payment proxy write.
 * UI and API error messages divide by this to show human-friendly credits.
 */
export const CREDITS_PER_PAYMENT_EVENT = 800;

export type CreditChargeReason = Exclude<CreditLedgerReason, "initial_grant">;

/** Per-operation costs in atomic ledger units (integers only). */
export const CREDIT_OPERATION_COST_ATOMIC: Record<CreditChargeReason, number> =
  {
    payment_proxy_write: CREDITS_PER_PAYMENT_EVENT,
    agent_register: 400,
    inbox_agent_register: 400,
  };

export const INITIAL_CREDIT_GRANT_PAYMENT_UNITS = 20;

export const INITIAL_CREDIT_GRANT_ATOMIC =
  INITIAL_CREDIT_GRANT_PAYMENT_UNITS * CREDITS_PER_PAYMENT_EVENT;

/** @deprecated Use {@link getCreditCostForReason} — kept for tests importing the old name. */
export const CREDIT_COST = CREDIT_OPERATION_COST_ATOMIC.payment_proxy_write;

export function getCreditCostForReason(reason: CreditChargeReason): number {
  return CREDIT_OPERATION_COST_ATOMIC[reason];
}

export function atomicCreditsToDisplayUnits(atomicCredits: number): number {
  return atomicCredits / CREDITS_PER_PAYMENT_EVENT;
}

export function displayUnitsToAtomicCredits(displayUnits: number): number {
  return Math.round(displayUnits * CREDITS_PER_PAYMENT_EVENT);
}
