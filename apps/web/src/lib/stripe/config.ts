import "server-only";

import Stripe from "stripe";

import { authEnvConfig } from "@/lib/config/auth.config";

/** Pin to the API version this library’s types target — avoids dashboard drift. */
const STRIPE_API_VERSION =
  "2025-02-24.acacia" satisfies Stripe.LatestApiVersion;

const LOG_PREFIX = "[stripe]";

/** ISO 4217 (lowercase) for Checkout `line_items`; keep in sync with display formatting. */
export const STRIPE_CHECKOUT_CURRENCY = "usd" as const;

function readOptionalTrimmed(name: string): string | null {
  const v = process.env[name];
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Env names / hints still needed for Checkout + webhooks. Empty means top-up is ready.
 * Production and local dev are expected to set these; the UI calls this out if not.
 */
function listStripeTopUpConfigurationGaps(): string[] {
  const missing: string[] = [];
  if (readOptionalTrimmed("STRIPE_SECRET_KEY") == null) {
    missing.push("STRIPE_SECRET_KEY");
  }
  if (readOptionalTrimmed("STRIPE_WEBHOOK_SECRET") == null) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }
  if (readOptionalTrimmed("STRIPE_CREDIT_PRODUCT_ID") == null) {
    missing.push("STRIPE_CREDIT_PRODUCT_ID");
  }
  if (getCreditUnitAmountCents() <= 0) {
    missing.push(
      "STRIPE_CREDIT_UNIT_AMOUNT_CENTS (positive integer, cents per credit)",
    );
  }
  return missing;
}

export function isStripeTopUpEnabled(): boolean {
  return listStripeTopUpConfigurationGaps().length === 0;
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
  stripeSingleton = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
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
