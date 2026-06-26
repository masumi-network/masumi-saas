import "server-only";

import prisma from "@masumi/database/client";
import { redirect } from "next/navigation";

import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { canAccessX402Workspace } from "@/lib/auth/org-roles";
import {
  type AuthenticatedApiContext,
  ForbiddenError,
  getAuthenticatedOrThrow,
} from "@/lib/auth/utils";

export {
  canAccessX402Workspace,
  canManageX402OrgBudgets,
  isOrgAdminRole,
} from "@/lib/auth/org-roles";

export async function getActiveOrgMemberRole(
  userId: string,
  organizationId: string | null,
): Promise<string | null> {
  if (!organizationId) return null;

  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });

  return member?.role ?? null;
}

async function memberRoleForAuth(
  authContext: AuthenticatedApiContext,
): Promise<string | null> {
  return getActiveOrgMemberRole(
    authContext.user.id,
    authContext.activeOrganizationId,
  );
}

/**
 * Session x402 access: personal account (any user) or org workspace (admin only).
 * OIDC callers use scope checks elsewhere.
 */
export async function requireX402SessionAccess(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    return;
  }

  const role = await memberRoleForAuth(authContext);
  if (canAccessX402Workspace(authContext.activeOrganizationId, role)) {
    return;
  }

  throw new ForbiddenError(
    "x402 is only available to organization admins while an organization workspace is active",
  );
}

/** Budgets: same workspace access as other x402 features (personal or org admin). */
export async function requireX402SessionBudgetAccess(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "write",
    });
    return;
  }

  const role = await memberRoleForAuth(authContext);
  if (!canAccessX402Workspace(authContext.activeOrganizationId, role)) {
    throw new ForbiddenError(
      "x402 budgets require access to the x402 workspace",
    );
  }
}

export async function requireX402SessionBudgetReadAccess(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  if (authContext.authMethod === "oidcAccessToken") {
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "read",
    });
    return;
  }

  const role = await memberRoleForAuth(authContext);
  if (!canAccessX402Workspace(authContext.activeOrganizationId, role)) {
    throw new ForbiddenError(
      "x402 budgets require access to the x402 workspace",
    );
  }
}

/** @deprecated Use requireX402SessionBudgetAccess — org admin when org workspace is active. */
export async function requireX402SessionOrgAdmin(
  authContext: AuthenticatedApiContext,
): Promise<void> {
  await requireX402SessionBudgetAccess(authContext);
}

export async function requireX402PageAccess(): Promise<void> {
  const authContext = await getAuthenticatedOrThrow({
    requireEmailVerified: false,
  });

  const role = await memberRoleForAuth(authContext);
  if (!canAccessX402Workspace(authContext.activeOrganizationId, role)) {
    redirect("/");
  }
}
