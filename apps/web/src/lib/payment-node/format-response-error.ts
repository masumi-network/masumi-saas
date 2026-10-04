/**
 * Human-readable message from a payment-node JSON error body or HTTP fallback.
 */
export function formatPaymentNodeResponseError(
  json: unknown,
  httpFallback: string,
): string {
  if (json == null || typeof json !== "object") {
    return httpFallback;
  }

  const record = json as Record<string, unknown>;
  const err = record.error;

  if (typeof err === "string" && err.trim()) {
    return err;
  }

  if (err != null && typeof err === "object") {
    const nested = err as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message;
    }
    if (typeof nested.error === "string" && nested.error.trim()) {
      return nested.error;
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return httpFallback;
}
