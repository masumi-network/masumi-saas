/**
 * Preset tiers + safe bounds — safe for Client Components (no server-only imports).
 */

/** Featured one-click tiers on the Top up page */
export const TOP_UP_PRESET_CREDIT_AMOUNTS = [10, 25, 50, 100] as const;

/** Inclusive; preset + manual entry must satisfy (server-validated). */
export const CREDIT_TOP_UP_AMOUNT_MIN = 1;
export const CREDIT_TOP_UP_AMOUNT_MAX = 500_000;

/**
 * Validates a whole-number credit quantity for Stripe Checkout creation.
 */
export function isAllowedCreditTopUpAmount(n: number): boolean {
  return (
    Number.isInteger(n) &&
    n >= CREDIT_TOP_UP_AMOUNT_MIN &&
    n <= CREDIT_TOP_UP_AMOUNT_MAX
  );
}
