import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";
import {
  exchangeAuthForOidcTokenSet,
  OIDC_NO_STORE_HEADERS,
  OidcTokenExchangeError,
} from "@/lib/auth/oidc-flow";
import { OIDC_SUPPORTED_SCOPES, oidcEnvConfig } from "@/lib/config/oidc.config";

const authHandler = toNextJsHandler(auth);

const DEVICE_CODE_PATH = "/api/auth/device/code";
const DEVICE_TOKEN_PATH = "/api/auth/device/token";
const OAUTH_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";
const OAUTH_TOKEN_PATH = "/api/auth/oauth2/token";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

function getPathname(request: Request): string {
  return new URL(request.url).pathname;
}

function hasContentType(request: Request, value: string): boolean {
  return request.headers.get("content-type")?.includes(value) ?? false;
}

function createJsonRequest(
  request: Request,
  url: string,
  body: Record<string, string>,
): Request {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return new Request(url, {
    method: request.method,
    headers,
    body: JSON.stringify(body),
  });
}

function createConsentPromptedAuthorizeRequest(
  request: Request,
): Request | null {
  const url = new URL(request.url);
  if (url.pathname !== OAUTH_AUTHORIZE_PATH) {
    return null;
  }

  if (url.searchParams.get("client_id") !== oidcEnvConfig.web.clientId) {
    return null;
  }

  const prompt = url.searchParams.get("prompt");
  if (prompt?.split(" ").includes("none")) {
    return null;
  }

  if (prompt?.split(" ").includes("consent")) {
    return null;
  }

  url.searchParams.set("prompt", prompt ? `${prompt} consent` : "consent");
  return new Request(url, request);
}

function createSessionAuthHeaders(
  request: Request,
  sessionToken: string,
): Headers {
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${sessionToken}`,
    "sec-fetch-mode": "cors",
  });

  const origin = request.headers.get("origin");
  if (origin) headers.set("origin", origin);

  return headers;
}

async function readBodyFields(
  request: Request,
): Promise<Record<string, string> | null> {
  try {
    if (hasContentType(request, "application/x-www-form-urlencoded")) {
      const formData = await request.clone().formData();
      return Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [
          key,
          typeof value === "string" ? value : value.name,
        ]),
      );
    }

    if (hasContentType(request, "application/json")) {
      const body = await request.clone().json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
      }

      return Object.fromEntries(
        Object.entries(body).map(([key, value]) => [key, String(value)]),
      );
    }
  } catch {
    return null;
  }

  return null;
}

async function exchangeDeviceGrantForOidcToken(
  request: Request,
  body: Record<string, string>,
): Promise<Response> {
  const deviceTokenRequest = createJsonRequest(
    request,
    new URL(DEVICE_TOKEN_PATH, request.url).toString(),
    body,
  );
  const deviceTokenResponse = await authHandler.POST(deviceTokenRequest);

  if (!deviceTokenResponse.ok) {
    return deviceTokenResponse;
  }

  const deviceTokenBody =
    ((await deviceTokenResponse.json().catch(() => null)) as Record<
      string,
      unknown
    > | null) ?? null;
  const sessionToken =
    deviceTokenBody && typeof deviceTokenBody.access_token === "string"
      ? deviceTokenBody.access_token
      : null;

  if (!sessionToken) {
    return Response.json(
      {
        error: "server_error",
        error_description:
          "Device token exchange did not return a session access token",
      },
      {
        status: 500,
        headers: OIDC_NO_STORE_HEADERS,
      },
    );
  }

  try {
    const exchange = await exchangeAuthForOidcTokenSet({
      requestUrl: request.url,
      clientKey: "cli",
      authHeaders: createSessionAuthHeaders(request, sessionToken),
      scopes: OIDC_SUPPORTED_SCOPES,
    });

    return Response.json(exchange.token, {
      headers: OIDC_NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof OidcTokenExchangeError) {
      return Response.json(
        {
          error: error.status >= 500 ? "server_error" : "invalid_grant",
          error_description: error.message,
        },
        {
          status: error.status >= 500 ? 500 : 400,
          headers: OIDC_NO_STORE_HEADERS,
        },
      );
    }

    console.error("[OIDC device grant] Failed to exchange device token", error);
    return Response.json(
      {
        error: "server_error",
        error_description: "Failed to exchange device token",
      },
      {
        status: 500,
        headers: OIDC_NO_STORE_HEADERS,
      },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  const consentRequest = createConsentPromptedAuthorizeRequest(request);
  if (consentRequest) {
    return authHandler.GET(consentRequest);
  }

  return authHandler.GET(request);
}

export async function POST(request: Request): Promise<Response> {
  const pathname = getPathname(request);

  if (
    pathname === DEVICE_CODE_PATH &&
    hasContentType(request, "application/x-www-form-urlencoded")
  ) {
    const body = await readBodyFields(request);
    if (body) {
      return authHandler.POST(createJsonRequest(request, request.url, body));
    }
  }

  if (pathname === DEVICE_TOKEN_PATH || pathname === OAUTH_TOKEN_PATH) {
    const body = await readBodyFields(request);
    if (body?.grant_type === DEVICE_CODE_GRANT) {
      return exchangeDeviceGrantForOidcToken(request, body);
    }
  }

  return authHandler.POST(request);
}
