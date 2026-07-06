import "server-only";

import { isPaidTopUpAmountConsistentWithCredits } from "@/lib/stripe/checkout-amounts";
import {
  getStripeClient,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
  STRIPE_CHECKOUT_CURRENCY,
} from "@/lib/stripe/config";
import { parseVerifiedTopUpCheckoutMetadata } from "@/lib/stripe/top-up-metadata";

const STRIPE_CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export function isValidStripeCheckoutSessionId(id: string): boolean {
  return STRIPE_CHECKOUT_SESSION_ID.test(id);
}

export type TopUpReturnSessionInfo =
  | { ok: true; credits: number; paymentStatus: string }
  | { ok: false; reason: "not_found" | "wrong_user" | "invalid" };

/**
 * Validates that a Checkout session belongs to this user and is a paid top-up
 * (for success messaging only; credits are applied via webhook).
 */
export async function verifyTopUpReturnSession(params: {
  userId: string;
  sessionId: string;
}): Promise<TopUpReturnSessionInfo> {
  if (!isValidStripeCheckoutSessionId(params.sessionId)) {
    return { ok: false, reason: "invalid" };
  }

  const stripe = getStripeClient();
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(params.sessionId);
  } catch {
    return { ok: false, reason: "not_found" };
  }

  if (session.metadata?.masumi_purpose !== MASUMI_CHECKOUT_METADATA_PURPOSE) {
    return { ok: false, reason: "invalid" };
  }

  const topUpMetadata = parseVerifiedTopUpCheckoutMetadata(session.metadata);
  if (!topUpMetadata) {
    return { ok: false, reason: "invalid" };
  }
  if (topUpMetadata.userId !== params.userId) {
    return { ok: false, reason: "wrong_user" };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, reason: "invalid" };
  }
  if (
    session.mode !== "payment" ||
    session.currency !== STRIPE_CHECKOUT_CURRENCY
  ) {
    return { ok: false, reason: "invalid" };
  }

  if (session.amount_total !== topUpMetadata.amountTotalCents) {
    return { ok: false, reason: "invalid" };
  }

  if (
    !isPaidTopUpAmountConsistentWithCredits({
      credits: topUpMetadata.credits,
      amountTotal: session.amount_total,
    })
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    credits: topUpMetadata.credits,
    paymentStatus: session.payment_status,
  };
}
