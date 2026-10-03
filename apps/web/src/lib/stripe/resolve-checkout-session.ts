import "server-only";

import type Stripe from "stripe";

/**
 * Resolve a Masumi Checkout Session id from a Stripe Charge (refunds / disputes).
 */
export async function resolveCheckoutSessionIdForCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<string | null> {
  const paymentIntent = charge.payment_intent;
  if (paymentIntent == null) {
    return null;
  }
  const paymentIntentId =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;

  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  });

  return sessions.data[0]?.id ?? null;
}
