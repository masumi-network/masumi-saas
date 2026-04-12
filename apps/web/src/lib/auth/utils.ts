import "server-only";

import prisma from "@masumi/database/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

import { authConfig } from "@/lib/config/auth.config";
import { normalizeScopeList } from "@/lib/config/oidc-scopes.config";

import { auth } from "./auth";
import { getBootstrapAdminIds } from "./config";
import {
  getBetterAuthInnerSession,
  type SessionWithOrganization,
} from "./session-types";

/** Full session object from Better Auth after a successful lookup. */
export type AuthSessionFull = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export type ApiAuthMethod = "session" | "apiKey" | "oidcAccessToken";

/**
 * Single return shape for {@link getAuthenticatedOrThrow}: headers, guaranteed user + session,
 * and active org id when the organization plugin is enabled.
 */
export type AuthenticatedApiContext = {
  headers: Headers;
  session: AuthSessionFull | null;
  user: NonNullable<AuthSessionFull["user"]>;
  activeOrganizationId: string | null;
  authMethod: ApiAuthMethod;
  oidcClientId: string | null;
  oidcScopes: string[];
};

/** Thrown when the request has no valid session or API key. Use for 401 responses in API routes. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Thrown when email verification is required but user has not verified. Use for 403 responses. */
export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Email verification required");
    this.name = "EmailNotVerifiedError";
  }
}

/** Thrown when an authenticated OIDC access token lacks the required scope. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
}

function getBearerToken(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveOidcAccessTokenContext(
  standardHeaders: Headers,
): Promise<AuthenticatedApiContext | null> {
  const bearerToken = getBearerToken(standardHeaders);
  if (
    !bearerToken ||
    bearerToken.startsWith(authConfig.apiKey.defaultKeyPrefix)
  ) {
    return null;
  }

  const accessToken = await prisma.oauthAccessToken.findUnique({
    where: { accessToken: bearerToken },
    include: { user: true },
  });

  if (!accessToken?.user || accessToken.accessTokenExpiresAt <= new Date()) {
    return null;
  }

  return {
    headers: standardHeaders,
    session: null,
    user: accessToken.user as NonNullable<AuthSessionFull["user"]>,
    activeOrganizationId: null,
    authMethod: "oidcAccessToken",
    oidcClientId: accessToken.clientId,
    oidcScopes: normalizeScopeList(accessToken.scopes),
  };
}

function buildSessionAuthContext(
  standardHeaders: Headers,
  session: AuthSessionFull,
): AuthenticatedApiContext {
  const innerSession = getBetterAuthInnerSession(session);
  const isApiKeyAuth =
    typeof innerSession?.token === "string" &&
    innerSession.token.startsWith(authConfig.apiKey.defaultKeyPrefix);

  return {
    headers: standardHeaders,
    user: session.user,
    session,
    activeOrganizationId: getActiveOrganizationId(session),
    authMethod: isApiKeyAuth ? "apiKey" : "session",
    oidcClientId: null,
    oidcScopes: [],
  };
}

export async function getRequestHeaders() {
  return await headers();
}

// M5 FIX: Cache session lookup to avoid duplicate DB queries per request
export const getSession = cache(async () => {
  try {
    const headersList = await getRequestHeaders();
    const standardHeaders =
      headersList instanceof Headers ? headersList : new Headers(headersList);
    return await auth.api.getSession({
      headers: standardHeaders,
    });
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
});

export async function getAuthContext(): Promise<AuthContext> {
  const session = await getSession();
  return {
    isAuthenticated: !!session?.user,
    userId: session?.user?.id ?? null,
    session,
  };
}

export async function getAuthContextWithHeaders(): Promise<
  AuthContext & {
    headers: Headers;
    user: NonNullable<
      NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"]
    >;
  }
> {
  const authContext = await getAuthenticatedOrThrow();

  return {
    isAuthenticated: true,
    userId: authContext.user.id,
    session: authContext.session,
    headers: authContext.headers,
    user: authContext.user,
  };
}

function getActiveOrganizationId(
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null,
): string | null {
  return (
    (session as SessionWithOrganization)?.session?.activeOrganizationId ?? null
  );
}

export interface GetAuthenticatedOptions {
  /** When true (default when REQUIRE_EMAIL_VERIFICATION is on), throws if user has not verified email. Set false for flows that must work before verification (e.g. accept-invitation). */
  requireEmailVerified?: boolean;
}

/**
 * Returns the current user and session. Supports both:
 * - Session (cookie): browser requests with a logged-in session.
 * - API key: prefer `x-api-key: <key>`; `Authorization: Bearer <key>` is still accepted for compatibility.
 * Throws UnauthorizedError when neither is valid. Use handleAuthError() in API route catch blocks to return 401.
 * When REQUIRE_EMAIL_VERIFICATION is true, throws EmailNotVerifiedError if user has not verified email (403).
 * Pass { requireEmailVerified: false } to skip the email check for flows like accept-invitation.
 *
 * Call as getAuthenticatedOrThrow(request) for API routes, or getAuthenticatedOrThrow(options) when passing options only.
 */
export async function getAuthenticatedOrThrow(
  requestOrOptions?: Request | GetAuthenticatedOptions,
  options?: GetAuthenticatedOptions,
): Promise<AuthenticatedApiContext> {
  const request =
    requestOrOptions instanceof Request ? requestOrOptions : undefined;
  const opts =
    requestOrOptions instanceof Request
      ? options
      : (requestOrOptions ?? options);

  const headersList =
    request instanceof Request ? request.headers : await getRequestHeaders();
  const standardHeaders =
    headersList instanceof Headers ? headersList : new Headers(headersList);
  const session = await auth.api.getSession({
    headers: standardHeaders,
  });

  const authContext =
    session?.user != null
      ? buildSessionAuthContext(standardHeaders, session)
      : await resolveOidcAccessTokenContext(standardHeaders);

  if (!authContext) {
    throw new UnauthorizedError();
  }

  const requireEmailVerified =
    opts?.requireEmailVerified ??
    authConfig.emailAndPassword.requireEmailVerification;
  if (requireEmailVerified && authContext.user.emailVerified !== true) {
    throw new EmailNotVerifiedError();
  }

  return authContext;
}

/** Use in API route catch blocks: returns 401 for UnauthorizedError, 403 for EmailNotVerifiedError, otherwise null. */
export function handleAuthError(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (error instanceof EmailNotVerifiedError) {
    return NextResponse.json(
      { success: false, error: "Email verification required" },
      { status: 403 },
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Centralized admin check. A user is admin if:
 * 1. Their DB role field is "admin", OR
 * 2. Their user ID is in the ADMIN_USER_IDS env var (bootstrap mechanism)
 */
export function isAdminUser(user: {
  id: string;
  role?: string | null;
}): boolean {
  if (user.role === "admin") return true;
  return getBootstrapAdminIds().includes(user.id);
}

/** Like getAuthContext() but also returns isAdmin flag */
// M5 FIX: Cache admin auth context to avoid duplicate DB queries per request
export const getAdminAuthContext = cache(async () => {
  const session = await getSession();
  return {
    isAuthenticated: !!session?.user,
    isAdmin: session?.user ? isAdminUser(session.user) : false,
    userId: session?.user?.id ?? null,
    session,
  };
});
