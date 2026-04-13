import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

export type CorsOptions = {
  extraAllowedOrigins?: readonly string[];
  allowCredentials?: boolean;
};

function isOriginAllowed(
  origin: string | null,
  options?: CorsOptions,
): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (options?.extraAllowedOrigins?.includes(origin)) return true;
  if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

function formatAllowedMethods(methods?: readonly string[]) {
  return (methods ?? ["GET", "OPTIONS"]).join(", ");
}

export function corsHeaders(
  request?: NextRequest,
  methods?: readonly string[],
  options?: CorsOptions,
): HeadersInit {
  const origin = request?.headers.get("origin") ?? null;
  const allowed = isOriginAllowed(origin, options);

  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "",
    "Access-Control-Allow-Methods": formatAllowedMethods(methods),
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, Authorization, x-api-key",
    "Access-Control-Max-Age": "86400",
    ...(allowed && options?.allowCredentials
      ? { "Access-Control-Allow-Credentials": "true" }
      : {}),
    ...(allowed ? { Vary: "Origin" } : {}),
  };
}

export function handleCorsPreflightResponse(
  request?: NextRequest,
  methods?: readonly string[],
  options?: CorsOptions,
): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request, methods, options),
  });
}

export function addCorsHeaders(
  response: NextResponse,
  request?: NextRequest,
  methods?: readonly string[],
  options?: CorsOptions,
): NextResponse {
  for (const [key, value] of Object.entries(
    corsHeaders(request, methods, options),
  )) {
    response.headers.set(key, value);
  }
  return response;
}
