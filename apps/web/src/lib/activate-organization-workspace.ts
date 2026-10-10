import { authClient } from "@/lib/auth/auth.client";

/** Better Auth `ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION`. */
const USER_NOT_MEMBER_OF_ORGANIZATION_MESSAGE =
  "User is not a member of the organization";

export function isUserNotMemberOfOrganizationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === USER_NOT_MEMBER_OF_ORGANIZATION_MESSAGE
  );
}

/**
 * Set Better Auth active organization (`null` = personal workspace).
 * Better Auth updates session cookies on this response and emits `$sessionSignal`.
 * Do not call `refetchSession()` or `router.refresh()` here; those race Set-Cookie
 * and can make RSC `getSession()` return null → `/signin`.
 */
export async function activateOrganizationWorkspace(
  organizationId: string | null,
): Promise<void> {
  const activation = await authClient.organization.setActive({
    organizationId,
  });

  if (activation.error) {
    throw new Error(
      activation.error.message ?? "Failed to set active organization",
    );
  }
}

/**
 * Activate org workspace with fallback to personal when membership was revoked
 * but the session still pointed at that org (matches Sokosumi behavior).
 */
export async function switchOrganizationWorkspace(
  organizationId: string | null,
): Promise<void> {
  try {
    await activateOrganizationWorkspace(organizationId);
  } catch (error) {
    if (!isUserNotMemberOfOrganizationError(error) || organizationId === null) {
      throw error;
    }

    await activateOrganizationWorkspace(null);
  }
}
