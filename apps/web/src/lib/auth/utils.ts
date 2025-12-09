import "server-only";

import { auth } from "./auth";

export interface AuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
}

export async function getSession() {
  return auth.api.getSession();
}

export async function getAuthContext(): Promise<AuthContext> {
  const session = await getSession();
  return {
    isAuthenticated: !!session?.user,
    userId: session?.user?.id ?? null,
    session,
  };
}

