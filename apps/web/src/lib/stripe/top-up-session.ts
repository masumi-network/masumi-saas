import "server-only";

import prisma from "@masumi/database/client";
import type { Stripe } from "stripe";

import {
  getAppBaseUrlForStripe,
  getCreditProductIdOrThrow,
  getCreditUnitAmountCents,
  getStripeClient,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
} from "@/lib/stripe/config";
import type { TopUpCredits } from "@/lib/stripe/top-up-constants";

function expectedAmountTotalCents(credits: number): number {
  return credits * getCreditUnitAmountCents();
}

export async function getOrCreateStripeCustomerId(
  userId: string,
): Promise<string> {
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

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
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
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
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

export function isExpectedCheckoutAmount(params: {
  credits: number;
  amountTotal: number | null;
}): boolean {
  if (params.amountTotal == null) return false;
  return params.amountTotal === expectedAmountTotalCents(params.credits);
}
