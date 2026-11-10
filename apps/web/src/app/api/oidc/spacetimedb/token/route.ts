import { isAPIError } from "better-auth/api";
import { NextResponse } from "next/server";
import { z } from "zod";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { auth } from "@/lib/auth/auth";
import { OIDC_NO_STORE_HEADERS } from "@/lib/auth/oidc/constants";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getTrustedOidcOrigins, oidcEnvConfig } from "@/lib/config/oidc.config";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

const requestSchema = z.object({
  client: z.enum(["web", "cli"]).default("web"),
});

const OIDC_BRIDGE_CORS_OPTIONS = {
  extraAllowedOrigins: getTrustedOidcOrigins(),
  allowCredentials: true,
} as const;

function jsonWithCors(
  request: Request,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  return addCorsHeaders(
    NextResponse.json(body, init),
    request,
    ["POST", "OPTIONS"],
    OIDC_BRIDGE_CORS_OPTIONS,
  );
}

/**
 * Only the browser session cookie may authenticate the token request.
 * Bearer and API-key headers would let the bearer or api-key plugins swap in
 * a different session, so they are not forwarded.
 */
const SESSION_BRIDGE_FORWARDED_HEADERS = [
  "cookie",
  "origin",
  "referer",
  "user-agent",
] as const;

function createSessionForwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const key of SESSION_BRIDGE_FORWARDED_HEADERS) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

const app = createApiApp("/api/oidc/spacetimedb/token");

app.options("/", (c) => {
  const request = c.req.raw;
  return handleCorsPreflightResponse(
    request,
    ["POST", "OPTIONS"],
    OIDC_BRIDGE_CORS_OPTIONS,
  );
});

app.post("/", async (c) => {
  const request = c.req.raw;
  try {
    // Authenticate with the same cookie-only headers that mint the tokens, so
    // the checks below apply to the user the tokens are issued for.
    const sessionHeaders = createSessionForwardedHeaders(request);
    const authContext = await getAuthenticatedOrThrow(
      new Request(request.url, { headers: sessionHeaders }),
    );

    if (authContext.authMethod !== "session") {
      return jsonWithCors(
        request,
        {
          success: false,
          error: "access_denied",
          error_description: "browser_session_required",
        },
        { status: 403 },
      );
    }

    if (authContext.user.emailVerified !== true) {
      return jsonWithCors(
        request,
        {
          success: false,
          error: "access_denied",
          error_description: "email_verification_required",
        },
        { status: 403 },
      );
    }

    const parsed = requestSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
      return jsonWithCors(
        request,
        { success: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const exchange = await auth.api.masumiIssueOidcSessionTokens({
      headers: sessionHeaders,
      body: { client: parsed.data.client },
    });

    return jsonWithCors(
      request,
      {
        success: true,
        issuer: oidcEnvConfig.issuer,
        clientId: exchange.clientId,
        token: exchange.token,
      },
      {
        headers: OIDC_NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    if (isAPIError(error)) {
      return jsonWithCors(
        request,
        {
          success: false,
          error: error.message,
          details: error.body,
        },
        { status: error.statusCode },
      );
    }

    const authResponse = handleAuthError(error);
    if (authResponse) {
      return addCorsHeaders(
        authResponse,
        request,
        ["POST", "OPTIONS"],
        OIDC_BRIDGE_CORS_OPTIONS,
      );
    }

    console.error("[OIDC bridge] Failed to mint SpacetimeDB token", error);
    return jsonWithCors(
      request,
      {
        success: false,
        error: "Failed to mint SpacetimeDB token",
      },
      { status: 500 },
    );
  }
});

export const { POST, OPTIONS } = nextHandlers(app);
export default app;
