import "server-only";

/** Node-only instrumentation: payment-node startup + x402 low-balance monitor. */
export async function registerNodeInstrumentation(): Promise<void> {
  warnIfX402EncryptionKeyMissing();
  await validatePaymentNodeAtStartup();
  startX402LowBalanceMonitor();
}

function warnIfX402EncryptionKeyMissing(): void {
  const key = process.env.X402_ENCRYPTION_KEY?.trim();
  if (key && key.length >= 32) return;

  console.warn(
    "[x402] X402_ENCRYPTION_KEY is missing or shorter than 32 characters. " +
      "Wallet create/list and payment routes will fail until you set it in apps/web/.env " +
      "(see .env.example). Generate one with: openssl rand -base64 32",
  );
}

async function validatePaymentNodeAtStartup(): Promise<void> {
  const {
    checkPaymentNodeHealth,
    isPaymentNodeConfigured,
    isSelfReferentialPaymentNodeBaseUrl,
  } = await import("./lib/payment-node/health");
  const { paymentNodeConfig } = await import("./lib/payment-node/config");

  if (!isPaymentNodeConfigured()) {
    const msg =
      "Payment node config missing: set PAYMENT_NODE_BASE_URL, PAYMENT_NODE_ADMIN_API_KEY, and PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD.";
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

function startX402LowBalanceMonitor(): void {
  const enabled = process.env.X402_LOW_BALANCE_MONITOR_ENABLED === "true";
  if (!enabled) return;

  const intervalMs = Number(
    process.env.X402_LOW_BALANCE_MONITOR_INTERVAL_MS ?? "60000",
  );
  if (!Number.isFinite(intervalMs) || intervalMs < 10_000) {
    console.warn(
      "[x402] invalid X402_LOW_BALANCE_MONITOR_INTERVAL_MS; monitor disabled",
    );
    return;
  }

  void import("./lib/x402/low-balance-monitor").then(
    ({ runX402LowBalanceMonitoringCycle }) => {
      const run = () => {
        void runX402LowBalanceMonitoringCycle().catch((error) => {
          console.error("[x402] low-balance monitoring cycle failed", error);
        });
      };
      run();
      setInterval(run, intervalMs);
      console.info("[x402] low-balance monitor started", { intervalMs });
    },
  );
}
