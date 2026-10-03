import "server-only";

import prisma from "@masumi/database/client";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";

import { clawBackCreditTopUpFromCheckoutSession } from "@/lib/credits/service";
import { serverLog } from "@/lib/server/logger";
import { MASUMI_CHECKOUT_METADATA_PURPOSE } from "@/lib/stripe/config";
import { parseVerifiedTopUpCheckoutMetadata } from "@/lib/stripe/top-up-metadata";

import { resolveCheckoutSessionIdForCharge } from "./resolve-checkout-session";

/** Stripe should retry when the top-up grant is not in the DB yet (event ordering). */
export class StripeClawbackRetryError extends Error {
  readonly checkoutSessionId: string;

  constructor(checkoutSessionId: string) {
    super(
      "Masumi top-up grant not persisted yet; retry clawback after checkout.session.completed",
    );
    this.name = "StripeClawbackRetryError";
    this.checkoutSessionId = checkoutSessionId;
  }
}

type MasumiTopUpClawbackContext =
  | { kind: "skip" }
  | { kind: "grant_pending"; checkoutSessionId: string }
  | {
      kind: "ready";
      checkoutSessionId: string;
      userId: string;
      grantCredits: number;
    };

function creditsToClawBackForRefund(
  grantCredits: number,
  charge: Stripe.Charge,
): number {
  if (grantCredits <= 0 || charge.amount <= 0 || charge.amount_refunded <= 0) {
    return 0;
  }
  return Math.min(
    grantCredits,
    Math.floor((grantCredits * charge.amount_refunded) / charge.amount),
  );
}

async function resolveMasumiTopUpClawbackContext(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<MasumiTopUpClawbackContext> {
  const checkoutSessionId = await resolveCheckoutSessionIdForCharge(
    stripe,
    charge,
  );
  if (checkoutSessionId == null) {
    return { kind: "skip" };
  }

  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  if (session.metadata?.masumi_purpose !== MASUMI_CHECKOUT_METADATA_PURPOSE) {
    return { kind: "skip" };
  }

  const grant = await prisma.creditLedgerEntry.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    select: { userId: true, delta: true },
  });
  if (grant == null || grant.delta <= 0) {
    if (session.payment_status !== "paid") {
      return { kind: "skip" };
    }
    const topUpMetadata = parseVerifiedTopUpCheckoutMetadata(session.metadata);
    if (topUpMetadata == null) {
      return { kind: "skip" };
    }
    const user = await prisma.user.findUnique({
      where: { id: topUpMetadata.userId },
      select: { id: true },
    });
    if (user == null) {
      return { kind: "skip" };
    }
    return { kind: "grant_pending", checkoutSessionId };
  }

  return {
    kind: "ready",
    checkoutSessionId,
    userId: grant.userId,
    grantCredits: grant.delta,
  };
}

function assertGrantReady(
  ctx: Exclude<MasumiTopUpClawbackContext, { kind: "skip" }>,
): asserts ctx is Extract<MasumiTopUpClawbackContext, { kind: "ready" }> {
  if (ctx.kind === "grant_pending") {
    throw new StripeClawbackRetryError(ctx.checkoutSessionId);
  }
}

async function clawBackForMasumiTopUp(params: {
  userId: string;
  checkoutSessionId: string;
  charge: Stripe.Charge;
  stripeEventId: string;
  creditsToClawBack: number;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (params.creditsToClawBack <= 0) {
    return;
  }

  const result = await clawBackCreditTopUpFromCheckoutSession({
    userId: params.userId,
    checkoutSessionId: params.checkoutSessionId,
    stripeEventId: params.stripeEventId,
    creditsToClawBack: params.creditsToClawBack,
    metadata: {
      chargeId: params.charge.id,
      ...params.metadata,
    },
  });

  if (result.shortfall > 0) {
    serverLog.warn(
      "[stripe webhook] credit clawback shortfall (credits spent)",
      {
        checkoutSessionId: params.checkoutSessionId,
        stripeEventId: params.stripeEventId,
        shortfall: result.shortfall,
        creditsRemoved: result.creditsRemoved,
      },
    );
    Sentry.captureMessage("Stripe credit clawback shortfall", {
      level: "warning",
      tags: { component: "stripe-webhook" },
      extra: {
        checkoutSessionId: params.checkoutSessionId,
        stripeEventId: params.stripeEventId,
        shortfall: result.shortfall,
        creditsRemoved: result.creditsRemoved,
      },
    });
  }
}

export async function processChargeRefunded(params: {
  stripe: Stripe;
  charge: Stripe.Charge;
  stripeEventId: string;
}): Promise<void> {
  const ctx = await resolveMasumiTopUpClawbackContext(
    params.stripe,
    params.charge,
  );
  if (ctx.kind === "skip") {
    return;
  }
  assertGrantReady(ctx);

  const creditsToClawBack = creditsToClawBackForRefund(
    ctx.grantCredits,
    params.charge,
  );

  await clawBackForMasumiTopUp({
    userId: ctx.userId,
    checkoutSessionId: ctx.checkoutSessionId,
    charge: params.charge,
    stripeEventId: params.stripeEventId,
    creditsToClawBack,
    metadata: {
      kind: "charge.refunded",
      amountRefunded: params.charge.amount_refunded,
      chargeAmount: params.charge.amount,
    },
  });
}

export async function processChargeDisputeCreated(params: {
  stripe: Stripe;
  dispute: Stripe.Dispute;
  stripeEventId: string;
}): Promise<void> {
  const chargeId =
    typeof params.dispute.charge === "string"
      ? params.dispute.charge
      : params.dispute.charge?.id;
  if (chargeId == null) {
    return;
  }

  const charge = await params.stripe.charges.retrieve(chargeId);
  const ctx = await resolveMasumiTopUpClawbackContext(params.stripe, charge);
  if (ctx.kind === "skip") {
    return;
  }
  assertGrantReady(ctx);

  await clawBackForMasumiTopUp({
    userId: ctx.userId,
    checkoutSessionId: ctx.checkoutSessionId,
    charge,
    stripeEventId: params.stripeEventId,
    creditsToClawBack: ctx.grantCredits,
    metadata: {
      kind: "charge.dispute.created",
      disputeId: params.dispute.id,
    },
  });
}
