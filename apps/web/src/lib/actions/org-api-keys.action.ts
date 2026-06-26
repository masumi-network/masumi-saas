"use server";

import { createHash, randomBytes } from "node:crypto";

import prisma from "@masumi/database/client";

import { getActiveOrgMemberRole } from "@/lib/auth/org-admin";
import { isOrgAdminRole } from "@/lib/auth/org-roles";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

import type { ApiKeyListItem } from "./auth.action";
import { getApiKeysAction } from "./auth.action";

export type OrgApiKeyListItem = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function hashOrgApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function generateOrgApiKeyMaterial(): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  // Org keys identify outbound x402 spend budgets; request auth remains session/OIDC.
  const rawKey = `mas_org_${randomBytes(24).toString("base64url")}`;
  return {
    rawKey,
    keyHash: hashOrgApiKey(rawKey),
    keyPrefix: rawKey.slice(0, 8),
  };
}

async function requireOrgAdminForActiveOrg(): Promise<{
  userId: string;
  organizationId: string;
}> {
  const { user, activeOrganizationId } = await getAuthenticatedOrThrow({
    requireEmailVerified: false,
  });

  if (!activeOrganizationId) {
    throw new Error("No active organization");
  }

  const role = await getActiveOrgMemberRole(user.id, activeOrganizationId);
  if (!isOrgAdminRole(role)) {
    throw new Error("Organization admin access required");
  }

  return { userId: user.id, organizationId: activeOrganizationId };
}

export async function getOrgApiKeysAction(): Promise<
  | { success: true; keys: OrgApiKeyListItem[] }
  | { success: false; error: string }
> {
  try {
    const { organizationId } = await requireOrgAdminForActiveOrg();

    const keys = await prisma.orgApiKey.findMany({
      where: { organizationId, enabled: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, keys };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load org API keys";
    return { success: false, error: message };
  }
}

export async function createOrgApiKeyAction(
  name: string,
): Promise<
  | { success: true; key: string; item: OrgApiKeyListItem }
  | { success: false; error: string }
> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: "Name is required" };
    }

    const { userId, organizationId } = await requireOrgAdminForActiveOrg();
    const { rawKey, keyHash, keyPrefix } = generateOrgApiKeyMaterial();

    const created = await prisma.orgApiKey.create({
      data: {
        name: trimmed,
        keyHash,
        keyPrefix,
        organizationId,
        createdById: userId,
        scopes: ["payments:read", "payments:write"],
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return { success: true, key: rawKey, item: created };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create org API key";
    return { success: false, error: message };
  }
}

export async function revokeOrgApiKeyAction(
  keyId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { organizationId } = await requireOrgAdminForActiveOrg();

    const updated = await prisma.orgApiKey.updateMany({
      where: { id: keyId, organizationId, enabled: true },
      data: { enabled: false },
    });

    if (updated.count === 0) {
      return { success: false, error: "API key not found" };
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke org API key";
    return { success: false, error: message };
  }
}

export type ApiKeysPageData =
  | {
      scope: "personal";
      keys: ApiKeyListItem[];
    }
  | {
      scope: "org";
      organizationName: string;
      canManage: boolean;
      keys: OrgApiKeyListItem[];
    };

export async function getApiKeysPageDataAction(): Promise<
  { success: true; data: ApiKeysPageData } | { success: false; error: string }
> {
  try {
    const { user, activeOrganizationId } = await getAuthenticatedOrThrow({
      requireEmailVerified: false,
    });

    if (!activeOrganizationId) {
      const result = await getApiKeysAction();
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true, data: { scope: "personal", keys: result.keys } };
    }

    const organization = await prisma.organization.findUnique({
      where: { id: activeOrganizationId },
      select: { name: true },
    });
    if (!organization) {
      return { success: false, error: "Organization not found" };
    }

    const role = await getActiveOrgMemberRole(user.id, activeOrganizationId);
    const canManage = isOrgAdminRole(role);

    if (!canManage) {
      return {
        success: true,
        data: {
          scope: "org",
          organizationName: organization.name,
          canManage: false,
          keys: [],
        },
      };
    }

    const keys = await prisma.orgApiKey.findMany({
      where: { organizationId: activeOrganizationId, enabled: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: {
        scope: "org",
        organizationName: organization.name,
        canManage: true,
        keys,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load API keys";
    return { success: false, error: message };
  }
}
