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
  const headersList = await getRequestHeaders();
  return auth.api.getSession({
    headers: headersList,
  });
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
  AuthContext & { headers: Awaited<ReturnType<typeof getRequestHeaders>> }
> {
  const headersList = await getRequestHeaders();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return {
    isAuthenticated: !!session?.user,
    userId: session?.user?.id ?? null,
    session,
    headers: headersList,
  };
}

export async function getAuthenticatedHeaders() {
  const headersList = await getRequestHeaders();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return headersList;
}
