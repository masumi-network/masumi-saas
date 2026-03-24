import { NextRequest, NextResponse } from "next/server";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import {
  checkPaymentNodeLiveness,
  isPaymentNodeConfigured,
} from "@/lib/payment-node/health";

function healthRateLimitOptionsForIp(ip: string) {
  const windowMs = parseInt(
    process.env.HEALTH_RATE_LIMIT_WINDOW_MS ?? "60000",
    10,
  );
  const maxKnown = parseInt(process.env.HEALTH_RATE_LIMIT_MAX ?? "30", 10);
  const maxUnknown = parseInt(
    process.env.HEALTH_RATE_LIMIT_MAX_UNIDENTIFIED ?? "300",
    10,
  );
  const window = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000;
  const capKnown = Number.isFinite(maxKnown) && maxKnown > 0 ? maxKnown : 30;
  const capUnknown =
    Number.isFinite(maxUnknown) && maxUnknown > 0 ? maxUnknown : 300;
  return {
    windowMs: window,
    maxRequests: ip === "unknown" ? capUnknown : capKnown,
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
    return NextResponse.json(
      {
        success: false,
        error: publicHealthPaymentNodeMessage(
          "Payment node is not configured (required for this deployment)",
        ),
        data: { status: "degraded", paymentNode: { ok: false } },
      },
      { status: 503 },
    );
  }

  const result = await checkPaymentNodeLiveness();
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: publicHealthPaymentNodeMessage(
          result.error ?? "Payment node unhealthy",
        ),
        data: { status: "degraded", paymentNode: { ok: false } },
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      status: "ok",
      paymentNode: { ok: true },
    },
  });
}
