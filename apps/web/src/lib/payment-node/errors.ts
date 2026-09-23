import type { ContentfulStatusCode } from "hono/utils/http-status";

import { ApiError } from "@/server/hono/errors";

const PAYMENT_NODE_ERROR_RE = /^(\d{3}): (.*)$/;

/**
 * Map payment-node client errors (`${status}: ${message}`) to ApiError so x402
 * routes can return 402 underfunded responses instead of opaque 500s.
 */
export function rethrowPaymentNodeClientError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }
  if (error instanceof Error) {
    const match = PAYMENT_NODE_ERROR_RE.exec(error.message);
    if (match != null) {
      const status = Number(match[1]);
      const message = match[2]?.trim() || "Payment node request failed";
      if (status >= 400 && status <= 599) {
        throw new ApiError(status as ContentfulStatusCode, message);
      }
    }
  }
  throw error;
}
