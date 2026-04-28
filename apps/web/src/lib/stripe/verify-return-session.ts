import "server-only";

import { isPaidTopUpAmountConsistentWithCredits } from "@/lib/stripe/checkout-amounts";
import {
  getStripeClient,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
} from "@/lib/stripe/config";

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
  if (session.metadata?.userId !== params.userId) {
    return { ok: false, reason: "wrong_user" };
  }

  const creditsRaw = session.metadata?.credits;
  const credits =
    typeof creditsRaw === "string"
      ? Number.parseInt(creditsRaw, 10)
      : Number.NaN;
  if (!Number.isFinite(credits) || credits <= 0) {
    return { ok: false, reason: "invalid" };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, reason: "invalid" };
  }

  if (
    !isPaidTopUpAmountConsistentWithCredits({
      credits,
      amountTotal: session.amount_total,
    })
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    credits,
    paymentStatus: session.payment_status,
  };
}
