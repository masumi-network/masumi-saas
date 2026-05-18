import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import {
  createSessionForwardedAuthHeaders,
  exchangeAuthForOidcTokenSet,
  OIDC_NO_STORE_HEADERS,
  OidcTokenExchangeError,
} from "@/lib/auth/oidc-flow";
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
  request: NextRequest,
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

const app = createApiApp("/api/oidc/spacetimedb/token");

app.options("/", (c) => {
  const request = new NextRequest(c.req.raw);
  return handleCorsPreflightResponse(
    request,
    ["POST", "OPTIONS"],
    OIDC_BRIDGE_CORS_OPTIONS,
  );
});

app.post("/", async (c) => {
  const request = new NextRequest(c.req.raw);
  try {
    const authContext = await getAuthenticatedOrThrow(request);

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

    const exchange = await exchangeAuthForOidcTokenSet({
      requestUrl: request.url,
      clientKey: parsed.data.client,
      authHeaders: createSessionForwardedAuthHeaders(request),
      scopes: ["openid", "profile", "email", "offline_access"],
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
    if (error instanceof OidcTokenExchangeError) {
      return jsonWithCors(
        request,
        {
          success: false,
          error: error.message,
          details: error.details,
        },
        { status: error.status },
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
