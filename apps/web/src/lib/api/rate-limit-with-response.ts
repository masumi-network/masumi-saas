import { NextResponse } from "next/server";

import { addCorsHeaders } from "@/lib/api/cors";
import { checkRateLimit, type RateLimitResult } from "@/lib/api/rate-limit";
import { ApiError } from "@/server/hono/errors";

function getClientIpForRateLimit(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

type RateLimitOptionsInput =
  | { windowMs?: number; maxRequests?: number }
  | ((ip: string) => { windowMs?: number; maxRequests?: number });

/**
 * Hono-friendly rate-limit check. Throws an `ApiError` on failure so the
 * shared `handleApiError` emits the response with CORS headers attached by
 * the route's CORS middleware.
 */
export async function checkRateLimitOrRespond(
  request: Request,
  keyPrefix: string,
  rateOptions?: RateLimitOptionsInput,
): Promise<{ allowed: true; rl: RateLimitResult }> {
  const ip = getClientIpForRateLimit(request);
  const resolved =
    typeof rateOptions === "function" ? rateOptions(ip) : rateOptions;
  const rl = await checkRateLimit(`${keyPrefix}:${ip}`, resolved);
  if (!rl.allowed) {
    if (rl.reason === "backend_unavailable") {
      throw new ApiError(503, "rate_limit_backend_unavailable");
    }
    const retryAfter = Math.max(0, Math.ceil((rl.resetAt - Date.now()) / 1000));
    throw new ApiError(429, "Rate limit exceeded. Please try again later.", {
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  return { allowed: true, rl };
}

/**
 * Legacy NextResponse-returning variant retained for non-Hono callers (the
 * OIDC token endpoint still uses it). Builds its own NextResponse and
 * decorates with CORS.
 */
export async function checkRateLimitOrLegacyResponse(
  request: Request,
  keyPrefix: string,
  rateOptions?: RateLimitOptionsInput,
  corsMethods?: readonly string[],
): Promise<
  { response: NextResponse } | { allowed: true; rl: RateLimitResult }
> {
  const ip = getClientIpForRateLimit(request);
  const resolved =
    typeof rateOptions === "function" ? rateOptions(ip) : rateOptions;
  const rl = await checkRateLimit(`${keyPrefix}:${ip}`, resolved);
  if (!rl.allowed) {
    if (rl.reason === "backend_unavailable") {
      return {
        response: addCorsHeaders(
          NextResponse.json(
            { success: false, error: "rate_limit_backend_unavailable" },
            { status: 503 },
          ),
          request,
          corsMethods,
        ),
      };
    }

    const res = NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      },
      { status: 429 },
    );
    res.headers.set(
      "Retry-After",
      String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
    );
    res.headers.set("X-RateLimit-Limit", String(rl.limit));
    res.headers.set("X-RateLimit-Remaining", "0");
    return { response: addCorsHeaders(res, request, corsMethods) };
  }
  return { allowed: true, rl };
}
