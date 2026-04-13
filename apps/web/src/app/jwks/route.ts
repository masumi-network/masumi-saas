import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const targetUrl = new URL("/api/auth/jwks", request.url);
  const response = await fetch(targetUrl, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control":
        response.headers.get("cache-control") ?? "public, max-age=300",
    },
  });
}
