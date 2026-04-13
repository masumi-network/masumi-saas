import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await validatePaymentNodeAtStartup();
  }

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/** Payment node: require config; optionally validate health and API key at startup. */
async function validatePaymentNodeAtStartup() {
  const {
    checkPaymentNodeHealth,
    isPaymentNodeConfigured,
    isSelfReferentialPaymentNodeBaseUrl,
  } = await import("./lib/payment-node/health");
  const { paymentNodeConfig } = await import("./lib/payment-node/config");

  if (!isPaymentNodeConfigured()) {
    const msg =
      "Payment node config missing: set PAYMENT_NODE_BASE_URL, PAYMENT_NODE_ADMIN_API_KEY, and PAYMENT_NODE_PAYMENT_SOURCE_ID.";
    console.error(`[payment-node] ${msg}`);
    throw new Error(msg);
  }

  const baseUrl = paymentNodeConfig.getBaseUrl();
  if (isSelfReferentialPaymentNodeBaseUrl(baseUrl)) {
    console.warn(
      `[payment-node] Skipping startup validation because PAYMENT_NODE_BASE_URL points to this app proxy (${baseUrl}).`,
    );
    return;
  }

  const result = await checkPaymentNodeHealth();
  if (result.ok) return;

  const strict =
    process.env.PAYMENT_NODE_STRICT_STARTUP === "1" ||
    process.env.PAYMENT_NODE_STRICT_STARTUP === "true";
  const detail =
    result.error ??
    (result.invalidKey
      ? "Invalid API key"
      : result.unreachable
        ? "Unreachable"
        : "Unknown");
  if (strict) {
    throw new Error(
      `[payment-node] Startup validation failed: ${detail}. Set PAYMENT_NODE_STRICT_STARTUP=0 to warn only.`,
    );
  }
  console.warn(
    `[payment-node] Health check failed (app will start): ${detail}`,
  );
}

export const onRequestError = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? Sentry.captureRequestError
  : undefined;
