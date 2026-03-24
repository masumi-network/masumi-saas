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

function paymentNodeOptional(): boolean {
  return (
    process.env.PAYMENT_NODE_OPTIONAL === "1" ||
    process.env.PAYMENT_NODE_OPTIONAL === "true"
  );
}

/**
 * Liveness for load balancers and scripts. No authentication.
 * When payment node env is required (not optional / unset), also pings
 * `GET {PAYMENT_NODE_BASE_URL}/health` — **503** if the node is unreachable or unhealthy.
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await checkRateLimitOrRespond(
    request,
    "health",
    healthRateLimitOptionsForIp,
  );
  if ("response" in rateLimitResult) return rateLimitResult.response;

  const optional = paymentNodeOptional();
  const configured = isPaymentNodeConfigured();

  if (!configured) {
    if (optional) {
      return NextResponse.json({
        success: true,
        data: {
          status: "ok",
          paymentNode: "skipped",
        },
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: "Payment node is not configured (required for this deployment)",
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
        error: result.error ?? "Payment node unhealthy",
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
