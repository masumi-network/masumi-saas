import prisma from "@masumi/database/client";

import {
  exchangeAuthForOidcTokenSet,
  OidcTokenExchangeError,
} from "@/lib/auth/oidc-flow";
import { createIdTokenForRefreshToken } from "@/lib/auth/oidc-id-token";
import {
  authHandler,
  createJsonRequest,
  getSessionForHeaders,
  handleMasumiAuthorizationCodeGrant,
  handleMasumiOidcAuthorizeRequest,
  hasContentType,
  logOidcScopeResolution,
  OIDC_ACCESS_DENIED,
  OIDC_EMAIL_VERIFICATION_REQUIRED,
  OIDC_NO_STORE_HEADERS,
  persistApprovedDeviceScopes,
  readBodyFields,
} from "@/lib/auth/oidc-route-helpers";
import { resolveOidcScopeGrantSet } from "@/lib/auth/oidc-user-grants";
import { oidcEnvConfig, resolveOidcClientKey } from "@/lib/config/oidc.config";
import {
  OIDC_STANDARD_SCOPES,
  serializeScopeList,
} from "@/lib/config/oidc-scopes.config";

const DEVICE_CODE_PATH = "/api/auth/device/code";
const DEVICE_APPROVE_PATH = "/api/auth/device/approve";
const DEVICE_TOKEN_PATH = "/api/auth/device/token";
const OAUTH_TOKEN_PATH = "/api/auth/oauth2/token";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_TOKEN_GRANT = "refresh_token";
const AUTHORIZATION_CODE_GRANT = "authorization_code";

function getPathname(request: Request): string {
  return new URL(request.url).pathname;
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

async function createScopedDeviceCodeRequest(
  request: Request,
  body: Record<string, string>,
): Promise<Request> {
  const clientId = body.client_id;
  const bodyWithScopedValue = { ...body };

  if (resolveOidcClientKey(clientId)) {
    const scopeResolution = await resolveOidcScopeGrantSet({
      clientId: clientId!,
      requestedScopes: body.scope ?? "openid",
      enforceStoredGrants: false,
    });
    logOidcScopeResolution("device-code-request", clientId!, scopeResolution);
    bodyWithScopedValue.scope = serializeScopeList(scopeResolution.finalScopes);
  }

  return createJsonRequest(request, request.url, bodyWithScopedValue);
}

async function getRequestedDeviceScopes(
  deviceCode: string | undefined,
): Promise<string[]> {
  if (!deviceCode) {
    return [...OIDC_STANDARD_SCOPES];
  }

  const record = await prisma.deviceCode.findUnique({
    where: { deviceCode },
    select: { scope: true },
  });

  return record?.scope?.trim()
    ? record.scope.split(" ").filter(Boolean)
    : [...OIDC_STANDARD_SCOPES];
}

async function getDeviceCodeExchangeRecord(deviceCode: string | undefined) {
  if (!deviceCode) {
    return null;
  }

  return prisma.deviceCode.findUnique({
    where: { deviceCode },
    select: {
      clientId: true,
      scope: true,
      userId: true,
    },
  });
}

async function exchangeDeviceGrantForOidcToken(
  request: Request,
  body: Record<string, string>,
): Promise<Response> {
  const deviceCodeRecord = await getDeviceCodeExchangeRecord(body.device_code);
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
    const sessionAuthHeaders = createSessionAuthHeaders(request, sessionToken);
    const session = await getSessionForHeaders(sessionAuthHeaders);
    const clientId =
      body.client_id ??
      deviceCodeRecord?.clientId ??
      oidcEnvConfig.cli.clientId;
    const resolvedUserId =
      session?.user?.id ?? deviceCodeRecord?.userId ?? null;
    const scopeResolution = await resolveOidcScopeGrantSet({
      clientId,
      requestedScopes:
        deviceCodeRecord?.scope ??
        (await getRequestedDeviceScopes(body.device_code)),
      userId: resolvedUserId,
      enforceStoredGrants: true,
    });
    logOidcScopeResolution("device-token-exchange", clientId, scopeResolution, {
      userId: resolvedUserId,
      deviceCode: body.device_code ?? null,
    });
    const scopes = scopeResolution.finalScopes;

    const exchange = await exchangeAuthForOidcTokenSet({
      requestUrl: request.url,
      clientKey: "cli",
      authHeaders: sessionAuthHeaders,
      scopes: scopes.length > 0 ? scopes : [...OIDC_STANDARD_SCOPES],
    });

    return Response.json(exchange.token, {
      headers: OIDC_NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof OidcTokenExchangeError) {
      const details =
        error.details && typeof error.details === "object"
          ? (error.details as Record<string, unknown>)
          : null;
      if (
        details?.error === OIDC_ACCESS_DENIED &&
        details?.error_description === OIDC_EMAIL_VERIFICATION_REQUIRED
      ) {
        return Response.json(details, {
          status: 403,
          headers: OIDC_NO_STORE_HEADERS,
        });
      }

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

async function exchangeRefreshGrantForOidcToken(
  request: Request,
): Promise<Response> {
  const refreshResponse = await authHandler.POST(request);
  if (!refreshResponse.ok) {
    return refreshResponse;
  }

  const refreshBody =
    ((await refreshResponse.json().catch(() => null)) as Record<
      string,
      unknown
    > | null) ?? null;

  if (!refreshBody) {
    return refreshResponse;
  }

  if (typeof refreshBody.id_token === "string") {
    return Response.json(refreshBody, {
      status: refreshResponse.status,
      headers: new Headers(refreshResponse.headers),
    });
  }

  const refreshToken =
    typeof refreshBody.refresh_token === "string"
      ? refreshBody.refresh_token
      : null;

  if (!refreshToken) {
    return Response.json(refreshBody, {
      status: refreshResponse.status,
      headers: new Headers(refreshResponse.headers),
    });
  }

  try {
    const idToken = await createIdTokenForRefreshToken(refreshToken);
    if (idToken) {
      refreshBody.id_token = idToken;
    } else {
      console.warn(
        "[OIDC refresh grant] No refreshed id_token could be generated",
      );
    }
  } catch (error) {
    console.error(
      "[OIDC refresh grant] Failed to mint refreshed id_token",
      error,
    );
  }

  const headers = new Headers(refreshResponse.headers);
  headers.delete("content-length");

  return Response.json(refreshBody, {
    status: refreshResponse.status,
    headers,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handleMasumiOidcAuthorizeRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  const pathname = getPathname(request);

  if (
    pathname === DEVICE_CODE_PATH &&
    hasContentType(request, "application/x-www-form-urlencoded")
  ) {
    const body = await readBodyFields(request);
    if (body) {
      return authHandler.POST(
        await createScopedDeviceCodeRequest(request, body),
      );
    }
  }

  if (pathname === DEVICE_APPROVE_PATH) {
    const body = await readBodyFields(request);
    const session = await getSessionForHeaders(request.headers);

    if (session?.user && session.user.emailVerified !== true) {
      return Response.json(
        {
          error: OIDC_ACCESS_DENIED,
          error_description: OIDC_EMAIL_VERIFICATION_REQUIRED,
        },
        {
          status: 403,
          headers: OIDC_NO_STORE_HEADERS,
        },
      );
    }

    const response = await authHandler.POST(request);

    if (response.ok && typeof body?.userCode === "string") {
      await persistApprovedDeviceScopes(request, body.userCode);
    }

    return response;
  }

  if (pathname === DEVICE_TOKEN_PATH || pathname === OAUTH_TOKEN_PATH) {
    const body = await readBodyFields(request);
    if (body?.grant_type === DEVICE_CODE_GRANT) {
      return exchangeDeviceGrantForOidcToken(request, body);
    }
    if (
      pathname === OAUTH_TOKEN_PATH &&
      body?.grant_type === AUTHORIZATION_CODE_GRANT
    ) {
      return handleMasumiAuthorizationCodeGrant(request, body);
    }
    if (
      pathname === OAUTH_TOKEN_PATH &&
      body?.grant_type === REFRESH_TOKEN_GRANT
    ) {
      return exchangeRefreshGrantForOidcToken(request);
    }
  }

  return authHandler.POST(request);
}
