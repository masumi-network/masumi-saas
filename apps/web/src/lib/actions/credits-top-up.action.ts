"use server";

import prisma from "@masumi/database/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { isStripeTopUpEnabled } from "@/lib/stripe/config";
import { isValidTopUpCredits } from "@/lib/stripe/top-up-constants";
import { createTopUpCheckoutSession } from "@/lib/stripe/top-up-session";

const startTopUpSchema = z.object({
  credits: z.coerce.number().int().positive().max(1_000_000),
});

export type StartCreditTopUpState = { ok: true } | { ok: false; error: string };

/**
 * Creates a Stripe Checkout session and redirects the browser. Only runs when
 * Stripe env is configured; otherwise returns an error state (caller may ignore).
 */
export async function startCreditTopUp(
  _prev: StartCreditTopUpState | undefined,
  formData: FormData,
): Promise<StartCreditTopUpState> {
  if (!isStripeTopUpEnabled()) {
    return {
      ok: false,
      error: "Stripe is not fully configured (set required STRIPE_* env vars).",
    };
  }

  const parsed = startTopUpSchema.safeParse({
    credits: formData.get("credits"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid credit amount" };
  }

  if (!isValidTopUpCredits(parsed.data.credits)) {
    return { ok: false, error: "Choose one of the listed packages" };
  }

  const { user } = await getAuthenticatedOrThrow({
    requireEmailVerified: true,
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { banned: true },
  });
  if (dbUser?.banned) {
    return { ok: false, error: "Your account cannot purchase credits" };
  }

  try {
    const checkout = await createTopUpCheckoutSession({
      userId: user.id,
      credits: parsed.data.credits,
    });
    if (!checkout.url) {
      return { ok: false, error: "Could not start checkout" };
    }
    redirect(checkout.url);
  } catch (err) {
    if (isRedirectError(err)) {
      throw err;
    }
    console.error("[credits top-up] createTopUpCheckoutSession", err);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}
