import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

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

/**
 * Returns the current user and session. Supports both:
 * - Session (cookie): browser requests with a logged-in session.
 * - API key: CLI/MCP/scripts send `Authorization: Bearer <key>` or `x-api-key: <key>`.
 * Throws UnauthorizedError when neither is valid. Use handleAuthError() in API route catch blocks to return 401.
 */
export async function getAuthenticatedOrThrow(request?: Request) {
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

  return {
    headers: standardHeaders,
    user: session.user,
    session,
    activeOrganizationId: getActiveOrganizationId(session),
  };
}

/** Use in API route catch blocks: returns 401 JSON response for UnauthorizedError, otherwise null. */
export function handleAuthError(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
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
