/**
 * Session shape from Better Auth organization plugin.
 * Use this type when reading activeOrganizationId from session
 * (server or client) so the type is defined in one place.
 */
export type SessionWithOrganization = {
  session?: { activeOrganizationId?: string | null };
};

/**
 * Inner `session` record on Better Auth `getSession()` (API key plugin stores id + token here).
 */
export type BetterAuthInnerSession = {
  id?: string;
  token?: string;
};

/**
 * Reads {@link BetterAuthInnerSession} from the full object returned by `auth.api.getSession()`.
 */
export function getBetterAuthInnerSession(
  fullSession: unknown,
): BetterAuthInnerSession | null {
  if (!fullSession || typeof fullSession !== "object") return null;
  if (!("session" in fullSession)) return null;
  const inner = (fullSession as { session: unknown }).session;
  if (!inner || typeof inner !== "object") return null;
  return inner as BetterAuthInnerSession;
}
