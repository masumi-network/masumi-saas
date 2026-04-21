import { createHash, randomBytes } from "node:crypto";

import prisma from "@masumi/database/client";
import { toNextJsHandler } from "better-auth/next-js";

import {
  getTrustedOidcClients,
  oidcEnvConfig,
  resolveOidcClientKey,
} from "../config/oidc.config";
import {
  OIDC_STANDARD_SCOPES,
  serializeScopeList,
} from "../config/oidc-scopes.config";
import { auth } from "./auth";
import {
  createOidcSessionId,
  createStoredOauthAccessToken,
  findDeviceCodeByUserCode,
  findVerificationByIdentifier,
} from "./auth-storage";
import { buildAbsoluteAppUrl } from "./callback-url";
import {
  createIdTokenForAccessTokenRecord,
  type OidcAccessTokenRecord,
} from "./oidc-id-token";
import {
  addUserOidcGrantScopes,
  type OidcScopeResolution,
  resolveOidcScopeGrantSet,
} from "./oidc-user-grants";
import { createEmptyBrowserRedirectResponse } from "./redirect-response";

export const authHandler = toNextJsHandler(auth);

export const OAUTH_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";
export const OIDC_ACCESS_DENIED = "access_denied";
export const OIDC_EMAIL_VERIFICATION_REQUIRED = "email_verification_required";
export const OIDC_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
} as const;

const OIDC_ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;
const OIDC_REFRESH_TOKEN_EXPIRES_IN_SECONDS = 604800;

type TrustedOidcClient = ReturnType<typeof getTrustedOidcClients>[number];
type AuthorizationCodeVerificationValue = {
  authTime?: unknown;
  clientId?: unknown;
  codeChallenge?: unknown;
  codeChallengeMethod?: unknown;
  nonce?: unknown;
  redirectURI?: unknown;
  scope?: unknown;
  userId?: unknown;
};

type AuthorizationCodeVerificationRecord = {
  id: string;
  value: string;
  expiresAt: Date;
};

function getScopeRemovalReasonLabel(
  reason: OidcScopeResolution["removedScopes"][number]["reason"],
): string {
  switch (reason) {
    case "unsupported_scope":
      return "scope is not part of the supported OIDC scope catalog";
    case "not_allowed_for_client":
      return "scope is not allowlisted for this client";
    case "not_yet_granted":
      return "scope has not been approved for this user yet";
    default:
      return reason;
  }
}

export function logOidcScopeResolution(
  flow:
    | "authorize-request"
    | "authorization-code-token"
    | "device-code-request"
    | "device-token-exchange",
  clientId: string,
  resolution: OidcScopeResolution,
  extra?: Record<string, unknown>,
) {
  if (!resolveOidcClientKey(clientId)) {
    return;
  }

  const removedScopes = resolution.removedScopes.map((item) => ({
    scope: item.scope,
    reason: getScopeRemovalReasonLabel(item.reason),
  }));

  if (removedScopes.length === 0) {
    return;
  }

  console.warn("[oidc scopes removed]", {
    flow,
    clientId,
    removedScopes,
    ...extra,
  });
}

export async function getSessionForHeaders(requestHeaders: Headers) {
  return auth.api.getSession({
    headers: requestHeaders,
  });
}

function isNonInteractiveOidcRequest(request: Request): boolean {
  const secFetchMode = request.headers.get("sec-fetch-mode");
  if (secFetchMode === "cors") {
    return true;
  }

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

export function hasContentType(request: Request, value: string): boolean {
  return request.headers.get("content-type")?.includes(value) ?? false;
}

export function createJsonRequest(
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

function createOauthJsonErrorResponse(
  error: string,
  errorDescription: string,
  status: number,
): Response {
  return Response.json(
    {
      error,
      error_description: errorDescription,
    },
    {
      status,
      headers: OIDC_NO_STORE_HEADERS,
    },
  );
}

function resolveTrustedOidcClient(
  clientId: string | null | undefined,
): TrustedOidcClient | null {
  if (!clientId) {
    return null;
  }

  return (
    getTrustedOidcClients().find((client) => client.clientId === clientId) ??
    null
  );
}

export function normalizeRequestedScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((scope): scope is string => typeof scope === "string");
  }

  if (typeof value === "string") {
    return value
      .split(" ")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  return [...OIDC_STANDARD_SCOPES];
}

function parseAuthorizationCodeVerificationValue(
  value: string,
): AuthorizationCodeVerificationValue | null {
  try {
    const parsed = JSON.parse(value) as AuthorizationCodeVerificationValue;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseClientCredentials(
  request: Request,
  body: Record<string, string>,
): {
  clientId: string | null;
  clientSecret: string | null;
  errorResponse: Response | null;
} {
  let clientId = body.client_id ?? null;
  let clientSecret = body.client_secret ?? null;
  const authorization = request.headers.get("authorization");

  if (
    authorization &&
    !clientId &&
    !clientSecret &&
    authorization.startsWith("Basic ")
  ) {
    try {
      const decoded = Buffer.from(
        authorization.slice("Basic ".length),
        "base64",
      ).toString("utf8");
      const separatorIndex = decoded.indexOf(":");
      if (separatorIndex <= 0) {
        throw new Error("invalid");
      }

      clientId = decoded.slice(0, separatorIndex);
      clientSecret = decoded.slice(separatorIndex + 1);
      if (!clientId || !clientSecret) {
        throw new Error("invalid");
      }
    } catch {
      return {
        clientId: null,
        clientSecret: null,
        errorResponse: createOauthJsonErrorResponse(
          "invalid_client",
          "invalid authorization header format",
          401,
        ),
      };
    }
  }

  return { clientId, clientSecret, errorResponse: null };
}

function verifyPkceChallenge(
  codeVerifier: string,
  expectedChallenge: string,
  method: string | null,
): boolean {
  if ((method ?? "S256").toLowerCase() === "plain") {
    return codeVerifier === expectedChallenge;
  }

  const actualChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return actualChallenge === expectedChallenge;
}

export async function handleMasumiAuthorizationCodeGrant(
  request: Request,
  body: Record<string, string>,
): Promise<Response> {
  const {
    clientId,
    clientSecret,
    errorResponse: authHeaderErrorResponse,
  } = parseClientCredentials(request, body);
  if (authHeaderErrorResponse) {
    return authHeaderErrorResponse;
  }

  if (!clientId) {
    return createOauthJsonErrorResponse(
      "invalid_client",
      "client_id is required",
      401,
    );
  }

  const client = resolveTrustedOidcClient(clientId);
  if (!client || client.disabled) {
    return createOauthJsonErrorResponse(
      "invalid_client",
      "invalid client_id",
      401,
    );
  }

  if (client.type !== "public" && !clientSecret) {
    return createOauthJsonErrorResponse(
      "invalid_client",
      "client_secret is required for confidential clients",
      401,
    );
  }

  const code = body.code;
  if (!code) {
    return createOauthJsonErrorResponse(
      "invalid_request",
      "code is required",
      400,
    );
  }

  const redirectUri = body.redirect_uri;
  if (!redirectUri) {
    return createOauthJsonErrorResponse(
      "invalid_request",
      "redirect_uri is required",
      400,
    );
  }

  const codeVerifier = body.code_verifier;
  if (!codeVerifier) {
    return createOauthJsonErrorResponse(
      "invalid_request",
      "code verifier is missing",
      400,
    );
  }

  const verificationRecord = (await findVerificationByIdentifier(code, {
    id: true,
    value: true,
    expiresAt: true,
  })) as AuthorizationCodeVerificationRecord | null;

  if (!verificationRecord) {
    return createOauthJsonErrorResponse("invalid_grant", "invalid code", 401);
  }

  if (verificationRecord.expiresAt < new Date()) {
    return createOauthJsonErrorResponse("invalid_grant", "code expired", 401);
  }

  const verificationValue = parseAuthorizationCodeVerificationValue(
    verificationRecord.value,
  );
  if (!verificationValue) {
    return createOauthJsonErrorResponse(
      "invalid_grant",
      "invalid code payload",
      401,
    );
  }

  if (verificationValue.clientId !== clientId) {
    return createOauthJsonErrorResponse(
      "invalid_client",
      "invalid client_id",
      401,
    );
  }

  if (verificationValue.redirectURI !== redirectUri) {
    return createOauthJsonErrorResponse(
      "invalid_client",
      "invalid redirect_uri",
      401,
    );
  }

  if (!client.redirectUrls.includes(redirectUri)) {
    return createOauthJsonErrorResponse(
      "invalid_client",
      "redirect_uri is not registered for this client",
      401,
    );
  }

  if (
    typeof verificationValue.userId !== "string" ||
    !verificationValue.userId
  ) {
    return createOauthJsonErrorResponse("invalid_grant", "user not found", 401);
  }

  if (typeof verificationValue.codeChallenge !== "string") {
    return createOauthJsonErrorResponse(
      "invalid_request",
      "code verifier is missing",
      400,
    );
  }

  if (
    !verifyPkceChallenge(
      codeVerifier,
      verificationValue.codeChallenge,
      typeof verificationValue.codeChallengeMethod === "string"
        ? verificationValue.codeChallengeMethod
        : null,
    )
  ) {
    return createOauthJsonErrorResponse(
      "invalid_request",
      "code verification failed",
      401,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: verificationValue.userId },
    select: {
      id: true,
      banned: true,
      email: true,
      emailVerified: true,
      name: true,
      image: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return createOauthJsonErrorResponse("invalid_grant", "user not found", 401);
  }

  if (user.banned) {
    return createOauthJsonErrorResponse(OIDC_ACCESS_DENIED, "user_banned", 403);
  }

  const deletedVerification = await prisma.verification.deleteMany({
    where: { id: verificationRecord.id },
  });
  if (deletedVerification.count === 0) {
    return createOauthJsonErrorResponse("invalid_grant", "invalid code", 401);
  }

  const issuedAt = new Date();
  const accessTokenExpiresAt = new Date(
    issuedAt.getTime() + OIDC_ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000,
  );
  const refreshTokenExpiresAt = new Date(
    issuedAt.getTime() + OIDC_REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000,
  );
  const accessToken = randomBytes(32).toString("base64url");
  const refreshToken = randomBytes(32).toString("base64url");
  const scopeResolution = await resolveOidcScopeGrantSet({
    clientId,
    requestedScopes: normalizeRequestedScopes(verificationValue.scope),
    userId: user.id,
    enforceStoredGrants: true,
  });
  logOidcScopeResolution(
    "authorization-code-token",
    clientId,
    scopeResolution,
    {
      userId: user.id,
    },
  );
  const scopes = scopeResolution.finalScopes;

  const tokenRecord = (await createStoredOauthAccessToken({
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    oidcSessionId: createOidcSessionId({
      authTime: verificationValue.authTime,
      userId: user.id,
    }),
    clientId,
    userId: user.id,
    scopes: scopes.join(" "),
    createdAt: issuedAt,
    updatedAt: issuedAt,
  })) as OidcAccessTokenRecord;

  const idToken = scopes.includes("openid")
    ? await createIdTokenForAccessTokenRecord(tokenRecord, {
        nonce:
          typeof verificationValue.nonce === "string"
            ? verificationValue.nonce
            : null,
      })
    : null;

  return Response.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: OIDC_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      refresh_token: scopes.includes("offline_access")
        ? refreshToken
        : undefined,
      scope: scopes.join(" "),
      id_token: idToken ?? undefined,
    },
    {
      headers: OIDC_NO_STORE_HEADERS,
    },
  );
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

  if (isNonInteractiveOidcRequest(request)) {
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

async function createGrantedScopeAuthorizeRequest(
  request: Request,
): Promise<Request> {
  const url = new URL(request.url);
  if (url.pathname !== OAUTH_AUTHORIZE_PATH) {
    return request;
  }

  const clientId = url.searchParams.get("client_id");
  if (!clientId || !resolveOidcClientKey(clientId)) {
    return request;
  }

  const session = await getSessionForHeaders(request.headers);
  const scopeResolution = await resolveOidcScopeGrantSet({
    clientId,
    requestedScopes: url.searchParams.get("scope") ?? "openid",
    userId: session?.user?.id,
    enforceStoredGrants: false,
  });
  logOidcScopeResolution("authorize-request", clientId, scopeResolution, {
    userId: session?.user?.id ?? null,
  });

  url.searchParams.set(
    "scope",
    serializeScopeList(scopeResolution.finalScopes),
  );
  return new Request(url, request);
}

function createOidcContinueUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}${url.hash}`;
}

function appendOidcErrorToRedirectUri(
  redirectUri: string,
  error: string,
  errorDescription: string,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", errorDescription);
  return url.toString();
}

function createOidcErrorResponse(
  request: Request,
  error: string,
  errorDescription: string,
  status = 403,
): Response {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!isNonInteractiveOidcRequest(request) && redirectUri) {
    return Response.redirect(
      appendOidcErrorToRedirectUri(redirectUri, error, errorDescription),
      302,
    );
  }

  return Response.json(
    {
      error,
      error_description: errorDescription,
    },
    {
      status,
      headers: OIDC_NO_STORE_HEADERS,
    },
  );
}

async function createUnverifiedOidcAuthorizeResponse(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== OAUTH_AUTHORIZE_PATH) {
    return null;
  }

  const clientId = url.searchParams.get("client_id");
  if (
    clientId !== oidcEnvConfig.web.clientId &&
    clientId !== oidcEnvConfig.cli.clientId
  ) {
    return null;
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session?.user || session.user.emailVerified === true) {
    return null;
  }

  if (
    clientId === oidcEnvConfig.web.clientId &&
    !isNonInteractiveOidcRequest(request)
  ) {
    return null;
  }

  return createOidcErrorResponse(
    request,
    OIDC_ACCESS_DENIED,
    OIDC_EMAIL_VERIFICATION_REQUIRED,
  );
}

async function ensureHeadlessWebConsent(request: Request): Promise<void> {
  const url = new URL(request.url);
  if (
    url.pathname !== OAUTH_AUTHORIZE_PATH ||
    url.searchParams.get("client_id") !== oidcEnvConfig.web.clientId ||
    !isNonInteractiveOidcRequest(request)
  ) {
    return;
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session?.user || session.user.emailVerified !== true) {
    return;
  }

  const scopes = url.searchParams.get("scope")?.trim() || "openid";
  const existingConsent = await prisma.oauthConsent.findFirst({
    where: {
      userId: session.user.id,
      clientId: oidcEnvConfig.web.clientId,
    },
    select: { id: true },
  });

  if (existingConsent) {
    await prisma.oauthConsent.update({
      where: { id: existingConsent.id },
      data: {
        scopes,
        consentGiven: true,
      },
    });
    return;
  }

  await prisma.oauthConsent.create({
    data: {
      userId: session.user.id,
      clientId: oidcEnvConfig.web.clientId,
      scopes,
      consentGiven: true,
    },
  });
}

async function appendContinueUrlToConsentRedirect(
  request: Request,
  response: Response,
): Promise<Response> {
  const url = new URL(request.url);
  if (
    url.pathname !== OAUTH_AUTHORIZE_PATH ||
    url.searchParams.get("client_id") !== oidcEnvConfig.web.clientId ||
    isNonInteractiveOidcRequest(request)
  ) {
    return response;
  }

  const continueUrl = createOidcContinueUrl(request);
  const location = response.headers.get("location");

  if (location) {
    const redirectUrl = new URL(buildAbsoluteAppUrl(location));
    if (redirectUrl.pathname !== "/oidc/consent") {
      return createEmptyBrowserRedirectResponse(response);
    }

    redirectUrl.searchParams.set("continueUrl", continueUrl);
    return createEmptyBrowserRedirectResponse(response, redirectUrl.toString());
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return response;
  }

  const body =
    ((await response
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null) ?? null;

  if (!body || body.redirect !== true || typeof body.url !== "string") {
    return response;
  }

  const redirectUrl = new URL(buildAbsoluteAppUrl(body.url));
  if (redirectUrl.pathname !== "/oidc/consent") {
    return response;
  }

  redirectUrl.searchParams.set("continueUrl", continueUrl);

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return Response.json(
    {
      ...body,
      url: redirectUrl.toString(),
    },
    {
      status: response.status,
      headers,
    },
  );
}

export async function handleMasumiOidcAuthorizeRequest(
  request: Request,
): Promise<Response> {
  const promptAwareRequest =
    createConsentPromptedAuthorizeRequest(request) ?? request;
  const authorizeRequest =
    await createGrantedScopeAuthorizeRequest(promptAwareRequest);
  const unverifiedResponse =
    await createUnverifiedOidcAuthorizeResponse(authorizeRequest);
  if (unverifiedResponse) {
    return unverifiedResponse;
  }

  await ensureHeadlessWebConsent(authorizeRequest);
  const response = await authHandler.GET(authorizeRequest);
  return appendContinueUrlToConsentRedirect(authorizeRequest, response);
}

export async function readBodyFields(
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

export async function persistApprovedDeviceScopes(
  request: Request,
  userCode: string,
): Promise<void> {
  const session = await getSessionForHeaders(request.headers);
  if (!session?.user?.id) {
    return;
  }

  const normalizedUserCode = userCode.trim().replace(/-/g, "").toUpperCase();
  const deviceCodeRecord = await findDeviceCodeByUserCode(normalizedUserCode, {
    clientId: true,
    scope: true,
  });

  if (!deviceCodeRecord?.clientId) {
    return;
  }

  await addUserOidcGrantScopes({
    userId: session.user.id,
    clientId: deviceCodeRecord.clientId,
    scopes: deviceCodeRecord.scope ?? "",
  });
}
