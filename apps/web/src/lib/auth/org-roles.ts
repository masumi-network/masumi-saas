export function isOrgAdminRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Personal account → any user. Active org workspace → owner/admin only. */
export function canAccessX402Workspace(
  activeOrganizationId: string | null | undefined,
  memberRole: string | null | undefined,
): boolean {
  if (!activeOrganizationId) {
    return true;
  }

  return isOrgAdminRole(memberRole);
}

/** @deprecated Use canAccessX402Workspace — budgets follow the same workspace access as x402. */
export function canManageX402OrgBudgets(
  activeOrganizationId: string | null | undefined,
  memberRole: string | null | undefined,
): boolean {
  return canAccessX402Workspace(activeOrganizationId, memberRole);
}
