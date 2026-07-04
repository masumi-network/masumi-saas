import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  getWebhookSecretOrThrow,
  MASUMI_CHECKOUT_METADATA_PURPOSE,
  STRIPE_CHECKOUT_CURRENCY,
} from "@/lib/stripe/config";

const SIGNATURE_VERSION = "v1";
const SIGNATURE_METADATA_KEY = "masumi_signature";

type TopUpCheckoutSignaturePayload = {
  userId: string;
  credits: number;
  amountTotalCents: number;
  currency: typeof STRIPE_CHECKOUT_CURRENCY;
};

export type VerifiedTopUpCheckoutMetadata = TopUpCheckoutSignaturePayload & {
  purpose: typeof MASUMI_CHECKOUT_METADATA_PURPOSE;
};

function parsePositiveSafeInteger(raw: string | undefined): number | null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function canonicalizeTopUpSignaturePayload(
  payload: TopUpCheckoutSignaturePayload,
): string {
  return [
    SIGNATURE_VERSION,
    MASUMI_CHECKOUT_METADATA_PURPOSE,
    payload.userId,
    String(payload.credits),
    String(payload.amountTotalCents),
    payload.currency,
  ].join("\n");
}

function signTopUpCheckoutPayload(
  payload: TopUpCheckoutSignaturePayload,
): string {
  const digest = createHmac("sha256", getWebhookSecretOrThrow())
    .update(canonicalizeTopUpSignaturePayload(payload))
    .digest("base64url");
  return `${SIGNATURE_VERSION}.${digest}`;
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createTopUpCheckoutMetadata(params: {
  userId: string;
  credits: number;
  amountTotalCents: number;
}): Record<string, string> {
  const payload: TopUpCheckoutSignaturePayload = {
    userId: params.userId,
    credits: params.credits,
    amountTotalCents: params.amountTotalCents,
    currency: STRIPE_CHECKOUT_CURRENCY,
  };

  return {
    masumi_purpose: MASUMI_CHECKOUT_METADATA_PURPOSE,
    userId: payload.userId,
    credits: String(payload.credits),
    amountTotalCents: String(payload.amountTotalCents),
    currency: payload.currency,
    [SIGNATURE_METADATA_KEY]: signTopUpCheckoutPayload(payload),
  };
}

export function parseVerifiedTopUpCheckoutMetadata(
  metadata: Record<string, string> | null,
): VerifiedTopUpCheckoutMetadata | null {
  if (metadata?.masumi_purpose !== MASUMI_CHECKOUT_METADATA_PURPOSE) {
    return null;
  }

  const userId = metadata.userId?.trim();
  const credits = parsePositiveSafeInteger(metadata.credits);
  const amountTotalCents = parsePositiveSafeInteger(metadata.amountTotalCents);
  const currency = metadata.currency;
  const signature = metadata[SIGNATURE_METADATA_KEY];

  if (
    !userId ||
    credits === null ||
    amountTotalCents === null ||
    currency !== STRIPE_CHECKOUT_CURRENCY ||
    !signature
  ) {
    return null;
  }

  const payload = {
    userId,
    credits,
    amountTotalCents,
    currency,
  };
  const expectedSignature = signTopUpCheckoutPayload(payload);
  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  return {
    purpose: MASUMI_CHECKOUT_METADATA_PURPOSE,
    ...payload,
  };
}
