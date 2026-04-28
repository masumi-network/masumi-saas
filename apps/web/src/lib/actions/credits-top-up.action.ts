"use server";

import prisma from "@masumi/database/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { checkCreditTopUpSessionLimit } from "@/lib/api/rate-limit";
import {
  EmailNotVerifiedError,
  getAuthenticatedOrThrow,
  UnauthorizedError,
} from "@/lib/auth/utils";
import { serverLog } from "@/lib/server/logger";
import { isStripeTopUpEnabled } from "@/lib/stripe/config";
import {
  CREDIT_TOP_UP_AMOUNT_MAX,
  CREDIT_TOP_UP_AMOUNT_MIN,
} from "@/lib/stripe/top-up-constants";
import { createTopUpCheckoutSession } from "@/lib/stripe/top-up-session";
import { z } from "@/lib/zod-openapi";

const startTopUpSchema = z.object({
  credits: z.coerce
    .number()
    .int()
    .min(CREDIT_TOP_UP_AMOUNT_MIN)
    .max(CREDIT_TOP_UP_AMOUNT_MAX),
});

export type StartCreditTopUpState = { ok: true } | { ok: false; error: string };

/**
 * Creates a Stripe Checkout session and redirects the browser. Only runs when
 * Stripe env is configured; otherwise returns an error state (caller may ignore).
 *
 * Requires verified email for checkout; `/top-up` may still load with
 * `getAuthenticatedOrThrow({ requireEmailVerified: false })` so users see
 * balance and the verify banner—unverified submitters get a structured error.
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
    return {
      ok: false,
      error: `Enter a whole number between ${CREDIT_TOP_UP_AMOUNT_MIN.toLocaleString()} and ${CREDIT_TOP_UP_AMOUNT_MAX.toLocaleString()} credits.`,
    };
  }

  const tTopUp = await getTranslations("App.TopUp");

  let auth: Awaited<ReturnType<typeof getAuthenticatedOrThrow>>;
  try {
    auth = await getAuthenticatedOrThrow({
      requireEmailVerified: true,
    });
  } catch (err) {
    if (err instanceof EmailNotVerifiedError) {
      return {
        ok: false,
        error: tTopUp("emailVerificationRequired"),
      };
    }
    if (err instanceof UnauthorizedError) {
      return {
        ok: false,
        error: tTopUp("signInRequiredForPurchase"),
      };
    }
    throw err;
  }

  const { user } = auth;

  const rl = await checkCreditTopUpSessionLimit(user.id);
  if (!rl.allowed) {
    if (rl.reason === "backend_unavailable") {
      return {
        ok: false,
        error:
          "Checkout is temporarily unavailable. Please try again in a few minutes.",
      };
    }
    return {
      ok: false,
      error: "Too many checkout attempts. Please try again in a few minutes.",
    };
  }

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
    serverLog.error("[credits top-up] createTopUpCheckoutSession", { err });
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}
