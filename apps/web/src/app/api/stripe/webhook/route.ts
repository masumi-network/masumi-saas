import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { grantCreditTopUpFromCheckoutSession } from "@/lib/credits/service";
import {
  getStripeClient,
  getWebhookSecretOrThrow,
  isStripeTopUpEnabled,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
} from "@/lib/stripe/config";
import { isExpectedCheckoutAmount } from "@/lib/stripe/top-up-session";

export const runtime = "nodejs";

/**
 * Raw body is required for Stripe signature verification. Do not parse JSON first.
 */
export async function POST(request: NextRequest) {
  if (!isStripeTopUpEnabled()) {
    return NextResponse.json(
      { error: "Stripe top-up is not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecretOrThrow(),
    );
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await handleCheckoutSessionCompleted(session);
    } catch (err) {
      console.error(
        "[stripe webhook] checkout.session.completed handler error",
        {
          sessionId: session.id,
          err,
        },
      );
      return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  if (session.metadata?.masumi_purpose !== MASUMI_CHECKOUT_METADATA_PURPOSE) {
    return;
  }

  if (session.payment_status !== "paid") {
    console.warn("[stripe webhook] Session not paid, skipping", {
      sessionId: session.id,
    });
    return;
  }

  const userId = session.metadata?.userId?.trim();
  const creditsRaw = session.metadata?.credits;
  const credits =
    typeof creditsRaw === "string"
      ? Number.parseInt(creditsRaw, 10)
      : Number.NaN;

  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    console.error("[stripe webhook] Missing or invalid metadata", {
      sessionId: session.id,
      userId,
      creditsRaw,
    });
    return;
  }

  if (
    !isExpectedCheckoutAmount({
      credits,
      amountTotal: session.amount_total,
    })
  ) {
    console.error(
      "[stripe webhook] amount_total does not match configured pricing",
      {
        sessionId: session.id,
        credits,
        amountTotal: session.amount_total,
      },
    );
    return;
  }

  await grantCreditTopUpFromCheckoutSession({
    userId,
    credits,
    checkoutSessionId: session.id,
  });
}
