/**
 * Payment node health and config validation (server-side only).
 * Use at startup to fail fast or warn, or expose via API for UI status.
 */

import type { PaymentNodeNetwork } from "./client";
import { createPaymentNodeClient } from "./client";
import { paymentNodeConfig } from "./config";

export type PaymentNodeHealthResult = {
  ok: boolean;
  error?: string;
  /** Env vars (BASE_URL, ADMIN_API_KEY, PAYMENT_SOURCE_ID) are missing */
  configMissing?: boolean;
  /** Payment node did not respond (network error, timeout) */
  unreachable?: boolean;
  /** API key rejected (401) */
  invalidKey?: boolean;
};

const NETWORK_FOR_CHECK: PaymentNodeNetwork = "Preprod";

/**
 * Validates that payment node env is set and optionally checks reachability and API key.
 * Does not throw; returns a result object.
 * - configMissing: true if required env vars are not set.
 * - unreachable: true if we could not reach the payment node (network/timeout).
 * - invalidKey: true if the admin API key was rejected (401).
 */
export async function checkPaymentNodeHealth(): Promise<PaymentNodeHealthResult> {
  let baseUrl: string;
  let adminKey: string;
  try {
    baseUrl = paymentNodeConfig.getBaseUrl();
    adminKey = paymentNodeConfig.getAdminApiKey();
    paymentNodeConfig.getPaymentSourceId(); // ensure all required env is present
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Payment node config missing";
    return {
      ok: false,
      configMissing: true,
      error: message,
    };
  }

  const client = createPaymentNodeClient(baseUrl, adminKey);
  try {
    await client.getRegistry({ network: NETWORK_FOR_CHECK });
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const message = err.message;
    if (
      message.includes("401") ||
      message.toLowerCase().includes("unauthorized")
    ) {
      return {
        ok: false,
        invalidKey: true,
        error: "Payment node API key was rejected (401)",
      };
    }
    return {
      ok: false,
      unreachable: true,
      error: err.message || "Payment node unreachable",
    };
  }
}

/**
 * Returns true if payment node config is present (all required env vars set).
 * Does not ping the payment node; use checkPaymentNodeHealth() for that.
 */
export function isPaymentNodeConfigured(): boolean {
  try {
    paymentNodeConfig.getBaseUrl();
    paymentNodeConfig.getAdminApiKey();
    paymentNodeConfig.getPaymentSourceId();
    return true;
  } catch {
    return false;
  }
}
