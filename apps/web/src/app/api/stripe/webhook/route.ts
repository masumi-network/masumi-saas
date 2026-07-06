import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  CreditBalanceCapExceededError,
  grantCreditTopUpFromCheckoutSession,
} from "@/lib/credits/service";
import { serverLog } from "@/lib/server/logger";
import { isPaidTopUpAmountConsistentWithCredits } from "@/lib/stripe/checkout-amounts";
import {
  getStripeClient,
  getWebhookSecretOrThrow,
  isStripeTopUpEnabled,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
  STRIPE_CHECKOUT_CURRENCY,
} from "@/lib/stripe/config";
import { parseVerifiedTopUpCheckoutMetadata } from "@/lib/stripe/top-up-metadata";

/** Stripe webhook bodies are small; reject large payloads before buffering. */
const STRIPE_WEBHOOK_MAX_BYTES = 1024 * 1024;

function isPrismaRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}

function captureWebhookIntegrityFailure(
  message: string,
  extra: Record<string, unknown>,
): void {
  serverLog.error(message, extra);
  Sentry.captureMessage(message, {
    level: "error",
    tags: { component: "stripe-webhook" },
    extra,
  });
}

export const runtime = "nodejs";

/**
 * Raw body is required for Stripe signature verification. Do not parse JSON first.
 *
 * TODO: charge.refunded / charge.dispute.created — clawback or ops alert (credits
 * already granted + consumed is a financial risk). Track before production hardening.
 */
export async function POST(request: NextRequest) {
  if (!isStripeTopUpEnabled()) {
    return NextResponse.json(
      { error: "Required STRIPE_* environment variables are not set" },
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

  const contentLength = request.headers.get("content-length");
  if (contentLength != null) {
    const n = Number.parseInt(contentLength, 10);
    if (Number.isFinite(n) && n > STRIPE_WEBHOOK_MAX_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
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
    serverLog.error("[stripe webhook] Signature verification failed", { err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await processTopUpCheckoutSession(session);
    } catch (err) {
      if (err instanceof CreditBalanceCapExceededError) {
        serverLog.warn(
          "[stripe webhook] credit grant blocked by balance cap; returning retryable error",
          {
            sessionId: session.id,
            err,
          },
        );
        Sentry.captureException(err, {
          tags: { component: "stripe-webhook" },
          extra: { sessionId: session.id },
        });
        return NextResponse.json(
          { error: "Credit balance cap exceeded" },
          { status: 500 },
        );
      }
      if (isPrismaRecordNotFound(err)) {
        serverLog.warn(
          "[stripe webhook] credit grant skipped (user missing); acknowledging to stop retries",
          { sessionId: session.id, err },
        );
        return NextResponse.json({ received: true, skipped: true });
      }
      serverLog.error("[stripe webhook] checkout session handler error", {
        sessionId: session.id,
        err,
      });
      Sentry.captureException(err, {
        tags: { component: "stripe-webhook" },
        extra: { sessionId: session.id },
      });
      return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Idempotent credit grant for paid credit top-up sessions (card and async success paths).
 */
async function processTopUpCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.metadata?.masumi_purpose !== MASUMI_CHECKOUT_METADATA_PURPOSE) {
    return;
  }

  if (session.payment_status !== "paid") {
    serverLog.warn("[stripe webhook] Session not paid, skipping", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  if (
    session.mode !== "payment" ||
    session.currency !== STRIPE_CHECKOUT_CURRENCY
  ) {
    captureWebhookIntegrityFailure(
      "[stripe webhook] unexpected checkout session mode or currency",
      {
        sessionId: session.id,
        mode: session.mode,
        currency: session.currency,
      },
    );
    return;
  }

  const topUpMetadata = parseVerifiedTopUpCheckoutMetadata(session.metadata);

  if (!topUpMetadata) {
    captureWebhookIntegrityFailure(
      "[stripe webhook] Missing, invalid, or unsigned metadata",
      {
        sessionId: session.id,
        metadataKeys: Object.keys(session.metadata ?? {}),
      },
    );
    return;
  }

  const { userId, credits, amountTotalCents } = topUpMetadata;

  if (
    session.client_reference_id != null &&
    session.client_reference_id !== userId
  ) {
    captureWebhookIntegrityFailure(
      "[stripe webhook] client_reference_id does not match metadata.userId",
      {
        sessionId: session.id,
        clientReferenceId: session.client_reference_id,
        userId,
      },
    );
    return;
  }

  if (session.amount_total !== amountTotalCents) {
    captureWebhookIntegrityFailure(
      "[stripe webhook] amount_total does not match signed expected amount",
      {
        sessionId: session.id,
        amountTotal: session.amount_total,
        amountTotalCents,
      },
    );
    return;
  }

  if (
    !isPaidTopUpAmountConsistentWithCredits({
      credits,
      amountTotal: session.amount_total,
    })
  ) {
    captureWebhookIntegrityFailure(
      "[stripe webhook] amount_total is not consistent with metadata credits",
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
