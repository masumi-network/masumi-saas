import { createHash, randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  getTrustedOidcClient,
  OIDC_SUPPORTED_SCOPES,
  type OidcClientKey,
  oidcEnvConfig,
} from "@/lib/config/oidc.config";

const requestSchema = z.object({
  client: z.enum(["web", "cli"]).default("web"),
});

function getForwardedAuthHeaders(request: NextRequest): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "sec-fetch-mode": "cors",
  });

  for (const key of ["authorization", "cookie", "x-api-key"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }

  return headers;
}

function createPkcePair() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

function getClientConfig(clientKey: OidcClientKey) {
  const client = getTrustedOidcClient(clientKey);
  const redirectUrl = client.redirectUrls[0];

  if (!redirectUrl) {
    throw new Error(
      `[OIDC] No redirect URL configured for ${clientKey} client`,
    );
  }

  return { client, redirectUrl };
}

async function readJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedOrThrow(request);

    const parsed = requestSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { client, redirectUrl } = getClientConfig(parsed.data.client);
    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = randomBytes(16).toString("hex");
    const authHeaders = getForwardedAuthHeaders(request);

    const authorizeUrl = new URL("/api/auth/oauth2/authorize", request.url);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", client.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUrl);
    authorizeUrl.searchParams.set("scope", OIDC_SUPPORTED_SCOPES.join(" "));
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");

    const authorizeResponse = await fetch(authorizeUrl, {
      method: "GET",
      headers: authHeaders,
      cache: "no-store",
    });

    const authorizeBody = await readJsonSafe(authorizeResponse);
    if (!authorizeResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "OIDC authorize step failed",
          details: authorizeBody,
        },
        { status: authorizeResponse.status },
      );
    }

    const redirectTarget =
      typeof authorizeBody === "object" &&
      authorizeBody !== null &&
      "url" in authorizeBody &&
      typeof authorizeBody.url === "string"
        ? authorizeBody.url
        : null;

    if (!redirectTarget) {
      return NextResponse.json(
        {
          success: false,
          error: "OIDC authorize step did not return redirect URL",
          details: authorizeBody,
        },
        { status: 502 },
      );
    }

    const redirectUri = new URL(redirectTarget);
    const returnedState = redirectUri.searchParams.get("state");
    const code = redirectUri.searchParams.get("code");

    if (!code || returnedState !== state) {
      return NextResponse.json(
        {
          success: false,
          error: "OIDC authorize step returned invalid code or state",
        },
        { status: 502 },
      );
    }

    const tokenUrl = new URL("/api/auth/oauth2/token", request.url);
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client.clientId,
      code,
      redirect_uri: redirectUrl,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    const tokenJson = await readJsonSafe(tokenResponse);
    if (!tokenResponse.ok) {
      return addCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error: "OIDC token exchange failed",
            details: tokenJson,
          },
          { status: tokenResponse.status },
        ),
        request,
        ["POST", "OPTIONS"],
      );
    }

    return addCorsHeaders(
      NextResponse.json(
        {
          success: true,
          issuer: oidcEnvConfig.issuer,
          clientId: client.clientId,
          token: tokenJson,
        },
        {
          headers: {
            "Cache-Control": "no-store",
            Pragma: "no-cache",
          },
        },
      ),
      request,
      ["POST", "OPTIONS"],
    );
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return addCorsHeaders(authResponse, request, ["POST", "OPTIONS"]);
    }

    console.error("[OIDC bridge] Failed to mint SpacetimeDB token", error);
    return addCorsHeaders(
      NextResponse.json(
        {
          success: false,
          error: "Failed to mint SpacetimeDB token",
        },
        { status: 500 },
      ),
      request,
      ["POST", "OPTIONS"],
    );
  }
}
