import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { buildAbsoluteAppUrl } from "@/lib/auth/callback-url";

const authHandler = toNextJsHandler(auth);

export async function GET() {
  const response = await authHandler.GET(
    new Request(buildAbsoluteAppUrl("/api/auth/jwks"), {
      headers: {
        Accept: "application/json",
      },
    }),
  );

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
