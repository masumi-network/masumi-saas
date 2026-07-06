import "server-only";

/** Upper bound on implied cents-per-credit (sanity only; Stripe uses integer minor units). */
const MAX_IMPLIED_UNIT_CENTS = 1_000_000_000;

/**
 * Validates that Stripe's `amount_total` is exactly divisible by the credited
 * quantity from session metadata. That matches how we build Checkout
 * (`totalCents = credits × unit` on the same request), without comparing to the
 * **current** `STRIPE_CREDIT_UNIT_AMOUNT_CENTS`, so deploys that change the
 * env cannot reject in-flight payments or the success redirect verify path.
 */
export function isPaidTopUpAmountConsistentWithCredits(params: {
  credits: number;
  amountTotal: number | null;
}): boolean {
  if (params.amountTotal == null || params.amountTotal <= 0) {
    return false;
  }
  const { credits, amountTotal } = params;
  if (!Number.isFinite(credits) || credits <= 0 || !Number.isInteger(credits)) {
    return false;
  }
  if (!Number.isInteger(amountTotal)) {
    return false;
  }
  if (amountTotal % credits !== 0) {
    return false;
  }
  const impliedUnitCents = amountTotal / credits;
  if (impliedUnitCents < 1 || impliedUnitCents > MAX_IMPLIED_UNIT_CENTS) {
    return false;
  }
  return true;
}
