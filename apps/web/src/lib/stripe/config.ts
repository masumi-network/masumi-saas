import "server-only";

import Stripe from "stripe";

import { authEnvConfig } from "@/lib/config/auth.config";

const LOG_PREFIX = "[stripe]";

function readOptionalTrimmed(name: string): string | null {
  const v = process.env[name];
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t ? t : null;
}

/** All required for Checkout + webhooks. When false, top-up UI stays disabled. */
export function isStripeTopUpEnabled(): boolean {
  return (
    readOptionalTrimmed("STRIPE_SECRET_KEY") != null &&
    readOptionalTrimmed("STRIPE_WEBHOOK_SECRET") != null &&
    readOptionalTrimmed("STRIPE_CREDIT_PRODUCT_ID") != null &&
    getCreditUnitAmountCents() > 0
  );
}

export function getAppBaseUrlForStripe(): string {
  return (
    readOptionalTrimmed("NEXT_PUBLIC_APP_URL") ?? authEnvConfig.baseUrl
  ).replace(/\/+$/, "");
}

let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = readOptionalTrimmed("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error(`${LOG_PREFIX} STRIPE_SECRET_KEY is not configured`);
  }
  stripeSingleton = new Stripe(key, { typescript: true });
  return stripeSingleton;
}

/** Minor units (e.g. cents) charged per single credit. */
export function getCreditUnitAmountCents(): number {
  const raw = readOptionalTrimmed("STRIPE_CREDIT_UNIT_AMOUNT_CENTS");
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getWebhookSecretOrThrow(): string {
  const s = readOptionalTrimmed("STRIPE_WEBHOOK_SECRET");
  if (!s) {
    throw new Error(`${LOG_PREFIX} STRIPE_WEBHOOK_SECRET is not configured`);
  }
  return s;
}

export function getCreditProductIdOrThrow(): string {
  const id = readOptionalTrimmed("STRIPE_CREDIT_PRODUCT_ID");
  if (!id) {
    throw new Error(`${LOG_PREFIX} STRIPE_CREDIT_PRODUCT_ID is not configured`);
  }
  return id;
}

export const MASUMI_CHECKOUT_METADATA_PURPOSE = "credit_topup" as const;
