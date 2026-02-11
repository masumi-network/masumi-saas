import "server-only";

import { headers } from "next/headers";

import { auth } from "./auth";

export interface AuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
}

export async function getRequestHeaders() {
  return await headers();
}

export async function getSession() {
  try {
    const headersList = await getRequestHeaders();
    return await auth.api.getSession({
      headers: headersList,
    });
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

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
