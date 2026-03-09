import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders } from "@/lib/api/cors";
import { checkRateLimit, type RateLimitResult } from "@/lib/api/rate-limit";

export async function checkRateLimitOrRespond(
  request: NextRequest,
  keyPrefix: string,
): Promise<
  { response: NextResponse } | { allowed: true; rl: RateLimitResult }
> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rl = await checkRateLimit(`${keyPrefix}:${ip}`);
  if (!rl.allowed) {
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
    return { response: addCorsHeaders(res, request) };
  }
  return { allowed: true, rl };
}
