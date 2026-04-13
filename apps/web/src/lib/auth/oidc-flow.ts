import { createHash, randomBytes } from "node:crypto";

import { getTrustedOidcClient, oidcEnvConfig } from "../config/oidc.config";
import type { OidcClientKey } from "../config/oidc-scopes.config";
import {
  handleMasumiAuthorizationCodeGrant,
  handleMasumiOidcAuthorizeRequest,
  OAUTH_AUTHORIZE_PATH,
  OIDC_NO_STORE_HEADERS,
} from "./oidc-route-helpers";

const FORWARDED_AUTH_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
] as const;
const OAUTH_TOKEN_PATH = "/api/auth/oauth2/token";

export { OIDC_NO_STORE_HEADERS };

export class OidcTokenExchangeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OidcTokenExchangeError";
  }
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

function createInternalUrl(requestUrl: string, pathname: string): URL {
  return new URL(pathname, requestUrl);
}

function createInternalAuthorizeRequest(options: {
  requestUrl: string;
  clientId: string;
  redirectUrl: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  authHeaders: Headers;
}): Request {
  const authorizeUrl = createInternalUrl(
    options.requestUrl,
    OAUTH_AUTHORIZE_PATH,
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", options.clientId);
  authorizeUrl.searchParams.set("redirect_uri", options.redirectUrl);
  authorizeUrl.searchParams.set("scope", options.scopes.join(" "));
  authorizeUrl.searchParams.set("state", options.state);
  authorizeUrl.searchParams.set("code_challenge", options.codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "s256");

  return new Request(authorizeUrl, {
    method: "GET",
    headers: new Headers(options.authHeaders),
    cache: "no-store",
  });
}

function createInternalTokenRequest(options: {
  requestUrl: string;
  clientId: string;
  code: string;
  redirectUrl: string;
  codeVerifier: string;
}): {
  request: Request;
  body: Record<string, string>;
} {
  const tokenUrl = createInternalUrl(options.requestUrl, OAUTH_TOKEN_PATH);
  const body = {
    grant_type: "authorization_code",
    client_id: options.clientId,
    code: options.code,
    redirect_uri: options.redirectUrl,
    code_verifier: options.codeVerifier,
  };

  return {
    request: new Request(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
      cache: "no-store",
    }),
    body,
  };
}

export function createForwardedAuthHeaders(request: Request): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "sec-fetch-mode": "cors",
  });

  for (const key of FORWARDED_AUTH_HEADERS) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }

  return headers;
}

export async function exchangeAuthForOidcTokenSet(options: {
  requestUrl: string;
  clientKey: OidcClientKey;
  authHeaders: Headers;
  scopes: string[];
}): Promise<{
  clientId: string;
  issuer: string;
  token: Record<string, unknown>;
}> {
  const { client, redirectUrl } = getClientConfig(options.clientKey);
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomBytes(16).toString("hex");

  const authorizeResponse = await handleMasumiOidcAuthorizeRequest(
    createInternalAuthorizeRequest({
      requestUrl: options.requestUrl,
      clientId: client.clientId,
      redirectUrl,
      scopes: options.scopes,
      state,
      codeChallenge,
      authHeaders: options.authHeaders,
    }),
  );

  const authorizeBody = await readJsonSafe(authorizeResponse);
  if (!authorizeResponse.ok) {
    throw new OidcTokenExchangeError(
      "OIDC authorize step failed",
      authorizeResponse.status,
      authorizeBody,
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
    throw new OidcTokenExchangeError(
      "OIDC authorize step did not return redirect URL",
      502,
      authorizeBody,
    );
  }

  const redirectUri = new URL(redirectTarget);
  const returnedState = redirectUri.searchParams.get("state");
  const code = redirectUri.searchParams.get("code");

  if (!code || returnedState !== state) {
    throw new OidcTokenExchangeError(
      "OIDC authorize step returned invalid code or state",
      502,
    );
  }

  const tokenRequest = createInternalTokenRequest({
    requestUrl: options.requestUrl,
    clientId: client.clientId,
    code,
    redirectUrl,
    codeVerifier,
  });
  const tokenResponse = await handleMasumiAuthorizationCodeGrant(
    tokenRequest.request,
    tokenRequest.body,
  );

  const tokenJson = await readJsonSafe(tokenResponse);
  if (!tokenResponse.ok) {
    throw new OidcTokenExchangeError(
      "OIDC token exchange failed",
      tokenResponse.status,
      tokenJson,
    );
  }

  if (!tokenJson || typeof tokenJson !== "object" || Array.isArray(tokenJson)) {
    throw new OidcTokenExchangeError(
      "OIDC token exchange returned invalid payload",
      502,
      tokenJson,
    );
  }

  return {
    issuer: oidcEnvConfig.issuer,
    clientId: client.clientId,
    token: tokenJson as Record<string, unknown>,
  };
}
