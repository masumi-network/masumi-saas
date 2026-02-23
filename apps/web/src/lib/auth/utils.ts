import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "./auth";
import { getBootstrapAdminIds } from "./config";

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
    return await auth.api.getSession({
      headers: headersList,
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
    headers: Awaited<ReturnType<typeof getRequestHeaders>>;
    user: NonNullable<
      NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"]
    >;
  }
> {
  const headersList = await getRequestHeaders();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return {
    isAuthenticated: true,
    userId: session.user.id,
    session,
    headers: headersList,
    user: session.user,
  };
}

export async function getAuthenticatedOrThrow() {
  const headersList = await getRequestHeaders();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return {
    headers: headersList,
    user: session.user,
    session,
  };
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
