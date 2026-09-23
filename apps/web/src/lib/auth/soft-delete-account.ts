import "server-only";

import prisma from "@masumi/database/client";

const ACCOUNT_DELETION_LOCK_NAMESPACE = "account-deletion";
type OwnerLookupClient = Pick<typeof prisma, "member">;

async function getOwnedOrganizationIds(userId: string, db: OwnerLookupClient) {
  const memberships = await db.member.findMany({
    where: { userId, role: "owner" },
    select: { organizationId: true },
  });
  return memberships.map((member) => member.organizationId).sort();
}

async function assertOtherActiveOwners(
  userId: string,
  organizationIds: string[],
  db: OwnerLookupClient,
): Promise<void> {
  for (const organizationId of organizationIds) {
    const otherOwners = await db.member.count({
      where: {
        organizationId,
        role: "owner",
        userId: { not: userId },
        user: { banned: false },
      },
    });
    if (otherOwners === 0) {
      throw new Error(SOLE_ORG_OWNER_BLOCK_MESSAGE);
    }
  }
}

/**
 * `banReason` marker distinguishing a self-service account deletion from an
 * admin-initiated ban, so soft-deleted accounts can be told apart later.
 */
export const ACCOUNT_DELETED_BAN_REASON = "account_deleted";

/**
 * Message thrown from the `deleteUser.beforeDelete` hook to abort Better Auth's
 * hard delete once the account has been soft-disabled. `deleteAccountAction`
 * detects this to report success.
 */
export const ACCOUNT_SOFT_DELETED_MESSAGE = "__masumi_account_soft_deleted__";

/** User-facing message when a sole org owner tries to delete their account. */
export const SOLE_ORG_OWNER_BLOCK_MESSAGE =
  "You are the sole owner of an organization. Transfer ownership (or delete the organization) before deleting your account.";

/**
 * Block account deletion when the user is the ONLY owner of any organization.
 * Organizations cannot be hard-deleted (`disableOrganizationDeletion`), so
 * disabling their sole owner would leave the org unmanageable — no one could
 * transfer ownership or administer it. Force an explicit hand-off first.
 *
 * Throws a plain Error (not the soft-delete sentinel) so `deleteAccountAction`
 * surfaces the message and does NOT report success.
 */
export async function assertUserIsNotSoleOrgOwner(
  userId: string,
): Promise<void> {
  const organizationIds = await getOwnedOrganizationIds(userId, prisma);
  await assertOtherActiveOwners(userId, organizationIds, prisma);
}

/**
 * Soft-delete a user account: keep the row (and all of its financial/audit data
 * — payment attempts, settlements, agents) but block every authentication path.
 *
 * - `banned` is enforced natively by the admin plugin at sign-in and by the
 *   OIDC token path, covering password / magic-link / social sign-in.
 * - API keys mint sessions that DO NOT run the sign-in ban check, so they are
 *   disabled explicitly — the apikey plugin rejects `enabled: false` keys.
 * - OIDC access tokens are validated per-request by expiry only (see
 *   `resolveOidcAccessTokenContext`, which additionally checks `banned`), so
 *   any outstanding tokens are revoked here to avoid up-to-1h of residual API
 *   access.
 * - All existing sessions are revoked so live cookies stop working immediately.
 *
 * Idempotent: safe to run more than once for the same user.
 */
export async function softDeleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const organizationIds = await getOwnedOrganizationIds(userId, tx);
    // Lock in stable order so concurrent owners cannot both pass the check.
    for (const organizationId of organizationIds) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ACCOUNT_DELETION_LOCK_NAMESPACE}), hashtext(${organizationId}))`;
    }
    await assertOtherActiveOwners(userId, organizationIds, tx);

    await tx.user.update({
      where: { id: userId },
      data: {
        banned: true,
        banReason: ACCOUNT_DELETED_BAN_REASON,
        banExpires: null,
      },
    });

    await tx.apikey.updateMany({
      where: { userId },
      data: { enabled: false },
    });

    await tx.oauthAccessToken.deleteMany({ where: { userId } });

    await tx.session.deleteMany({ where: { userId } });
  });
}

/** True when an error is the sentinel signalling a completed soft delete. */
export function isAccountSoftDeletedSignal(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(ACCOUNT_SOFT_DELETED_MESSAGE)
  );
}
