import "server-only";

import prisma from "@masumi/database/client";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";

import { clawBackCreditTopUpFromCheckoutSession } from "@/lib/credits/service";
import { serverLog } from "@/lib/server/logger";

import { resolveCheckoutSessionIdForCharge } from "./resolve-checkout-session";

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

async function clawBackForCharge(params: {
  stripe: Stripe;
  charge: Stripe.Charge;
  stripeEventId: string;
  creditsToClawBack: number;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (params.creditsToClawBack <= 0) {
    return;
  }

  const checkoutSessionId = await resolveCheckoutSessionIdForCharge(
    params.stripe,
    params.charge,
  );
  if (checkoutSessionId == null) {
    return;
  }

  const grant = await prisma.creditLedgerEntry.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    select: { userId: true, delta: true },
  });
  if (grant == null || grant.delta <= 0) {
    return;
  }

  const result = await clawBackCreditTopUpFromCheckoutSession({
    userId: grant.userId,
    checkoutSessionId,
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
        checkoutSessionId,
        stripeEventId: params.stripeEventId,
        shortfall: result.shortfall,
        creditsRemoved: result.creditsRemoved,
      },
    );
    Sentry.captureMessage("Stripe credit clawback shortfall", {
      level: "warning",
      tags: { component: "stripe-webhook" },
      extra: {
        checkoutSessionId,
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
  const grant = await resolveGrantForCharge(params.stripe, params.charge);
  if (grant == null) {
    return;
  }

  const creditsToClawBack = creditsToClawBackForRefund(
    grant.delta,
    params.charge,
  );

  await clawBackForCharge({
    stripe: params.stripe,
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
  const grant = await resolveGrantForCharge(params.stripe, charge);
  if (grant == null) {
    return;
  }

  await clawBackForCharge({
    stripe: params.stripe,
    charge,
    stripeEventId: params.stripeEventId,
    creditsToClawBack: grant.delta,
    metadata: {
      kind: "charge.dispute.created",
      disputeId: params.dispute.id,
    },
  });
}

async function resolveGrantForCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<{ userId: string; delta: number } | null> {
  const checkoutSessionId = await resolveCheckoutSessionIdForCharge(
    stripe,
    charge,
  );
  if (checkoutSessionId == null) {
    return null;
  }

  return prisma.creditLedgerEntry.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    select: { userId: true, delta: true },
  });
}
