import "server-only";

import { getCreditUnitAmountCents } from "@/lib/stripe/config";

/**
 * True when the Checkout session's `amount_total` matches
 * `credits × STRIPE_CREDIT_UNIT_AMOUNT_CENTS` for the current config.
 */
export function isExpectedCheckoutAmount(params: {
  credits: number;
  amountTotal: number | null;
}): boolean {
  if (params.amountTotal == null) {
    return false;
  }
  const unitCents = getCreditUnitAmountCents();
  return params.amountTotal === params.credits * unitCents;
}
