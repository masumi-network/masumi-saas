import { NextResponse } from "next/server";

/**
 * CORS configuration for the public v1 API.
 *
 * By default, allows all origins (`*`) since v1 endpoints are read-only
 * public registry queries. If you add mutation or authenticated endpoints
 * to v1, restrict origins via the CORS_ALLOWED_ORIGIN env var.
 */
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN ?? "*";

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCorsPreflightResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export function addCorsHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}
