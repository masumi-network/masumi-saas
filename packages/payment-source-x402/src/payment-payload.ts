import { createHash } from "node:crypto";

import type { Prisma } from "@masumi/database";
import type { PaymentPayload } from "@x402/core/types";
import { extractAndValidatePaymentIdentifier } from "@x402/extensions/payment-identifier";
import canonicalStringify from "canonical-json";
import createHttpError from "http-errors";

import { encrypt } from "./encryption.js";

export function hashX402PaymentPayload(paymentPayload: unknown): string {
  const canonical = canonicalStringify(paymentPayload);
  // Never fall back to "": paymentPayloadHash is the settlement idempotency key,
  // so two payloads that both fail to canonicalize would collide on the same
  // hash and dedup to a single settlement. Reject instead.
  if (!canonical) {
    throw createHttpError(400, "Payment payload could not be canonicalized");
  }
  return createHash("sha256").update(canonical).digest("hex");
}

// The signed x402 payload embeds a reusable payment authorization (EIP-3009 / Permit2
// signature), so it is persisted encrypted at rest like every other wallet secret. It
// is a write-only audit record (never selected back by the service); decrypt with the
// configured key only for manual forensics. Stored as a JSON string in the Json column.
export function encryptPaymentPayloadForStorage(
  paymentPayload: unknown,
): Prisma.InputJsonValue {
  const canonical = canonicalStringify(paymentPayload);
  if (!canonical) {
    throw createHttpError(400, "Payment payload could not be canonicalized");
  }
  return encrypt(canonical);
}
export function getPaymentIdentifier(paymentPayload: PaymentPayload): {
  id: string | null;
  errors: string[];
} {
  const { id, validation } =
    extractAndValidatePaymentIdentifier(paymentPayload);
  return {
    id,
    errors: validation.valid
      ? []
      : (validation.errors ?? ["Invalid payment-identifier extension"]),
  };
}
