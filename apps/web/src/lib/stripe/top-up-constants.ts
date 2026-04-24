/**
 * Credit packages for Stripe top-up — safe to import from Client Components
 * (no server-only, no secrets).
 */
export const TOP_UP_CREDIT_OPTIONS = [10, 25, 50, 100] as const;
export type TopUpCredits = (typeof TOP_UP_CREDIT_OPTIONS)[number];

export function isValidTopUpCredits(n: number): n is TopUpCredits {
  return (TOP_UP_CREDIT_OPTIONS as readonly number[]).includes(n);
}
