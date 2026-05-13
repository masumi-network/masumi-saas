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
  /** Env vars (BASE_URL, ADMIN_API_KEY, PAYMENT_SOURCE_ID_PREPROD) are missing */
  configMissing?: boolean;
  /** Payment node did not respond (network error, timeout) */
  unreachable?: boolean;
  /** API key rejected (401) */
  invalidKey?: boolean;
};

const NETWORK_FOR_CHECK: PaymentNodeNetwork = "Preprod";

function normalizeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function appOriginsForPaymentNodeChecks(): string[] {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((value): value is string => Boolean(value?.trim()));

  return candidates
    .map((value) => normalizeUrl(value))
    .filter((value): value is URL => value !== null)
    .map((value) => value.origin);
}

export function isSelfReferentialPaymentNodeBaseUrl(baseUrl: string): boolean {
  const parsedBaseUrl = normalizeUrl(baseUrl);
  if (!parsedBaseUrl) {
    return false;
  }

  const normalizedPath = parsedBaseUrl.pathname.replace(/\/+$/, "");
  if (normalizedPath !== "/api/v1") {
    return false;
  }

  return appOriginsForPaymentNodeChecks().includes(parsedBaseUrl.origin);
}

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
    paymentNodeConfig.getPaymentSourceId(NETWORK_FOR_CHECK);
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
    paymentNodeConfig.getPaymentSourceId(NETWORK_FOR_CHECK);
    return true;
  } catch {
    return false;
  }
}

function paymentNodeHealthTimeoutMs(): number {
  const raw = process.env.PAYMENT_NODE_HEALTH_TIMEOUT_MS;
  const parsed =
    raw != null && raw !== "" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

/**
 * Payment service health GET target (no auth).
 * - Default: append `health` to `PAYMENT_NODE_BASE_URL` using the same base
 *   normalization as `client.ts` (`new URL('health', base + '/')`), i.e. Masumi
 *   payment service `GET /api/v1/health` when the base is `…/api/v1`.
 * - Optional `PAYMENT_NODE_HEALTH_URL`: full URL when a reverse proxy exposes
 *   liveness only at origin `/health` (or any non-default path).
 */
function paymentNodeLivenessRequestUrl(baseUrl: string): string {
  const override = process.env.PAYMENT_NODE_HEALTH_URL?.trim();
  if (override) return override;
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("health", base).toString();
}

/**
 * GET payment node health — no auth (public liveness).
 * Lighter than {@link checkPaymentNodeHealth} (no admin registry call).
 */
export async function checkPaymentNodeLiveness(): Promise<PaymentNodeHealthResult> {
  let baseUrl: string;
  try {
    baseUrl = paymentNodeConfig.getBaseUrl();
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Payment node config missing";
    return {
      ok: false,
      configMissing: true,
      error: message,
    };
  }

  const url = paymentNodeLivenessRequestUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    paymentNodeHealthTimeoutMs(),
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const trimmed = text.trim();

    let json: { status?: string; data?: { status?: string } };
    if (!trimmed) {
      console.error("[payment-node] health: empty response body", {
        url,
        status: res.status,
        contentType,
      });
      return {
        ok: false,
        unreachable: true,
        error: "Payment node /health returned an empty body",
      };
    }

    try {
      json = JSON.parse(trimmed) as {
        status?: string;
        data?: { status?: string };
      };
    } catch (parseErr) {
      const preview = trimmed.slice(0, 200);
      const isLikelyHtml = /^\s*</.test(trimmed);
      console.error("[payment-node] health: response is not valid JSON", {
        url,
        status: res.status,
        contentType,
        bodyPreview: preview,
        isLikelyHtml,
        parseError:
          parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      return {
        ok: false,
        unreachable: true,
        error: isLikelyHtml
          ? "Payment node /health returned HTML or non-JSON (check base URL and reverse proxy)"
          : "Payment node /health returned invalid JSON",
      };
    }

    if (res.ok && json?.status === "success" && json?.data?.status === "ok") {
      return { ok: true };
    }

    if (!res.ok) {
      return {
        ok: false,
        unreachable: true,
        error: `Payment node health returned HTTP ${res.status}`,
      };
    }

    return {
      ok: false,
      unreachable: true,
      error: "Unexpected payment node health response body",
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.name === "AbortError") {
      return {
        ok: false,
        unreachable: true,
        error: "Payment node health check timed out",
      };
    }
    console.error("[payment-node] health: request failed", {
      url,
      message: err.message,
    });
    return {
      ok: false,
      unreachable: true,
      error: err.message || "Payment node unreachable",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
