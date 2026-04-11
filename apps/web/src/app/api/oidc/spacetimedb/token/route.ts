import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import {
  createForwardedAuthHeaders,
  exchangeAuthForOidcTokenSet,
  OIDC_NO_STORE_HEADERS,
  OidcTokenExchangeError,
} from "@/lib/auth/oidc-flow";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getTrustedOidcOrigins, oidcEnvConfig } from "@/lib/config/oidc.config";

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

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(
    request,
    ["POST", "OPTIONS"],
    OIDC_BRIDGE_CORS_OPTIONS,
  );
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedOrThrow(request);

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
      authHeaders: createForwardedAuthHeaders(request),
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
}
