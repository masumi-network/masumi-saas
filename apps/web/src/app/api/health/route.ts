import { NextRequest } from "next/server";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import {
  checkPaymentNodeLiveness,
  isPaymentNodeConfigured,
} from "@/lib/payment-node/health";

import contract from "./route.contract";

function parsePositiveEnvInt(
  raw: string | undefined,
  defaultString: string,
  fallback: number,
): number {
  const value = raw != null && raw !== "" ? raw : defaultString;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Parsed once — env does not change at runtime in normal deployments. */
const HEALTH_RATE_LIMIT_WINDOW_MS = parsePositiveEnvInt(
  process.env.HEALTH_RATE_LIMIT_WINDOW_MS,
  "60000",
  60_000,
);
const HEALTH_RATE_LIMIT_MAX_KNOWN_IP = parsePositiveEnvInt(
  process.env.HEALTH_RATE_LIMIT_MAX,
  "30",
  30,
);
const HEALTH_RATE_LIMIT_MAX_UNKNOWN_IP = parsePositiveEnvInt(
  process.env.HEALTH_RATE_LIMIT_MAX_UNIDENTIFIED,
  "300",
  300,
);

function healthRateLimitOptionsForIp(ip: string) {
  return {
    windowMs: HEALTH_RATE_LIMIT_WINDOW_MS,
    maxRequests:
      ip === "unknown"
        ? HEALTH_RATE_LIMIT_MAX_UNKNOWN_IP
        : HEALTH_RATE_LIMIT_MAX_KNOWN_IP,
  };
}

/** Avoid leaking upstream URLs, status codes, or proxy details on the public health endpoint. */
function publicHealthPaymentNodeMessage(detail: string): string {
  return process.env.NODE_ENV === "production"
    ? "Payment node unavailable"
    : detail;
}

/**
 * Liveness for load balancers and scripts. No authentication.
 * Requires payment node env; pings payment-node liveness (default
 * `GET {PAYMENT_NODE_BASE_URL}/health` per v1 API layout, or `PAYMENT_NODE_HEALTH_URL`) — **503** if
 * not configured, unreachable, or unhealthy.
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await checkRateLimitOrRespond(
    request,
    "health",
    healthRateLimitOptionsForIp,
  );
  if ("response" in rateLimitResult) return rateLimitResult.response;

  const configured = isPaymentNodeConfigured();

  if (!configured) {
    return contractJsonResponse(contract, "GET", 503, {
      success: false,
      error: publicHealthPaymentNodeMessage(
        "Payment node is not configured (required for this deployment)",
      ),
      data: { status: "degraded", paymentNode: { ok: false } },
    });
  }

  const result = await checkPaymentNodeLiveness();
  if (!result.ok) {
    return contractJsonResponse(contract, "GET", 503, {
      success: false,
      error: publicHealthPaymentNodeMessage(
        result.error ?? "Payment node unhealthy",
      ),
      data: { status: "degraded", paymentNode: { ok: false } },
    });
  }

  return contractJsonResponse(contract, "GET", 200, {
    success: true,
    data: {
      status: "ok",
      paymentNode: { ok: true },
    },
  });
}
