import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders } from "@/lib/api/cors";
import { checkRateLimit, type RateLimitResult } from "@/lib/api/rate-limit";

function getClientIpForRateLimit(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

type RateLimitOptionsInput =
  | { windowMs?: number; maxRequests?: number }
  | ((ip: string) => { windowMs?: number; maxRequests?: number });

export async function checkRateLimitOrRespond(
  request: NextRequest,
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
            {
              success: false,
              error: "rate_limit_backend_unavailable",
            },
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
