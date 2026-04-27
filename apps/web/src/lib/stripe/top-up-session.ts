import "server-only";

import prisma from "@masumi/database/client";
import type Stripe from "stripe";

import {
  getAppBaseUrlForStripe,
  getCreditProductIdOrThrow,
  getCreditUnitAmountCents,
  getStripeClient,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
  STRIPE_CHECKOUT_CURRENCY,
} from "@/lib/stripe/config";
import type { TopUpCredits } from "@/lib/stripe/top-up-constants";

function expectedAmountTotalCents(credits: number): number {
  return credits * getCreditUnitAmountCents();
}

export async function getOrCreateStripeCustomerId(
  userId: string,
): Promise<string> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { masumiUserId: user.id },
    });

    const assigned = await prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });

    if (assigned.count === 1) {
      return customer.id;
    }

    try {
      await stripe.customers.del(customer.id);
    } catch {
      // Best-effort cleanup of orphan test-mode customer; ignore secondary failures
    }
  }

  const final = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!final.stripeCustomerId) {
    throw new Error(
      "getOrCreateStripeCustomerId: could not assign Stripe customer",
    );
  }
  return final.stripeCustomerId;
}

export async function createTopUpCheckoutSession(params: {
  userId: string;
  credits: TopUpCredits;
}): Promise<Stripe.Response<Stripe.Checkout.Session>> {
  const unitCents = getCreditUnitAmountCents();
  const totalCents = expectedAmountTotalCents(params.credits);
  if (unitCents <= 0 || totalCents <= 0) {
    throw new Error("STRIPE_CREDIT_UNIT_AMOUNT_CENTS is invalid");
  }

  const customerId = await getOrCreateStripeCustomerId(params.userId);
  const stripe = getStripeClient();
  const productId = getCreditProductIdOrThrow();
  const base = getAppBaseUrlForStripe();

  return stripe.checkout.sessions.create({
    mode: "payment",
    /**
     * Card-only: immediate `payment_status: paid` on `checkout.session.completed`.
     * Other methods (ACH, SEPA, …) can be `processing` until a later event — we
     * do not enable them here, so customers are not left without a matching grant
     * until async events (see `checkout.session.async_payment_succeeded` in webhook).
     */
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: STRIPE_CHECKOUT_CURRENCY,
          product: productId,
          unit_amount: totalCents,
        },
      },
    ],
    success_url: `${base}/top-up?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/top-up?canceled=1`,
    client_reference_id: params.userId,
    metadata: {
      masumi_purpose: MASUMI_CHECKOUT_METADATA_PURPOSE,
      userId: params.userId,
      credits: String(params.credits),
    },
  });
}

export { isExpectedCheckoutAmount } from "@/lib/stripe/checkout-amounts";
