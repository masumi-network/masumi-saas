import { createRoute } from "@hono/zod-openapi";
import { NextRequest } from "next/server";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import {
  checkPaymentNodeLiveness,
  isPaymentNodeConfigured,
} from "@/lib/payment-node/health";
import {
  errBody,
  healthServiceUnavailableSchema,
  healthSuccessSchema,
  noSecurity,
} from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

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

const app = createApiApp("/api/health");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["System"],
    summary: "Health check",
    description:
      "Confirms this app and the Masumi payment service behind it are up. **503** means the payment service is unreachable or not reporting healthy.",
    security: noSecurity,
    responses: {
      200: {
        description: "App and payment service are healthy",
        content: {
          "application/json": { schema: healthSuccessSchema },
        },
      },
      429: {
        description: "Too many health checks from this client in the window",
        content: { "application/json": { schema: errBody } },
      },
      503: {
        description:
          "Payment service unreachable or unhealthy from this environment",
        content: {
          "application/json": { schema: healthServiceUnavailableSchema },
        },
      },
    },
  }),
  async (c) => {
    const request = new NextRequest(c.req.raw);
    const rateLimitResult = await checkRateLimitOrRespond(
      request,
      "health",
      healthRateLimitOptionsForIp,
    );
    if ("response" in rateLimitResult)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rateLimitResult.response as any;

    const configured = isPaymentNodeConfigured();

    if (!configured) {
      throw new ApiError(
        503,
        publicHealthPaymentNodeMessage(
          "Payment node is not configured (required for this deployment)",
        ),
        undefined,
        { data: { status: "degraded", paymentNode: { ok: false } } },
      );
    }

    const result = await checkPaymentNodeLiveness();
    if (!result.ok) {
      throw new ApiError(
        503,
        publicHealthPaymentNodeMessage(
          result.error ?? "Payment node unhealthy",
        ),
        undefined,
        { data: { status: "degraded", paymentNode: { ok: false } } },
      );
    }

    return c.json(
      {
        success: true as const,
        data: {
          status: "ok" as const,
          paymentNode: { ok: true },
        },
      },
      200,
    );
  },
);

export const { GET } = nextHandlers(app);
export default app;
