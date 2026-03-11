import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

import { authConfig } from "@/lib/config/auth.config";

import { auth } from "./auth";
import { getBootstrapAdminIds } from "./config";
import type { SessionWithOrganization } from "./session-types";

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

export interface AuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
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
  const headersList = await getRequestHeaders();
  const standardHeaders =
    headersList instanceof Headers ? headersList : new Headers(headersList);
  const session = await auth.api.getSession({
    headers: standardHeaders,
  });

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  return {
    isAuthenticated: true,
    userId: session.user.id,
    session,
    headers: standardHeaders,
    user: session.user,
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
 * - API key: CLI/MCP/scripts send `Authorization: Bearer <key>` or `x-api-key: <key>`.
 * Throws UnauthorizedError when neither is valid. Use handleAuthError() in API route catch blocks to return 401.
 * When REQUIRE_EMAIL_VERIFICATION is true, throws EmailNotVerifiedError if user has not verified email (403).
 * Pass { requireEmailVerified: false } to skip the email check for flows like accept-invitation.
 */
export async function getAuthenticatedOrThrow(
  request?: Request,
  options?: GetAuthenticatedOptions,
) {
  const headersList =
    request instanceof Request ? request.headers : await getRequestHeaders();
  const standardHeaders =
    headersList instanceof Headers ? headersList : new Headers(headersList);
  const session = await auth.api.getSession({
    headers: standardHeaders,
  });

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  const requireEmailVerified =
    options?.requireEmailVerified ??
    authConfig.emailAndPassword.requireEmailVerification;
  if (requireEmailVerified && session.user.emailVerified !== true) {
    throw new EmailNotVerifiedError();
  }

  return {
    headers: standardHeaders,
    user: session.user,
    session,
    activeOrganizationId: getActiveOrganizationId(session),
  };
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
