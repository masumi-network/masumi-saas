import "server-only";

import { headers } from "next/headers";

import { auth } from "./auth";

export interface AuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
}

export async function getSession() {
  const headersList = await headers();
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

