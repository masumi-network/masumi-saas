"use server";

import prisma from "@masumi/database/client";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

export type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type OrganizationAgentPreview = {
  id: string;
  name: string;
  icon: string | null;
  verificationStatus: string | null;
  registrationState: string;
};

export type OrganizationApiKeyPreview = {
  id: string;
  name: string;
  keyPrefix: string;
  enabled: boolean;
};

export type OrganizationDashboardData = {
  organization: OrganizationInfo;
  memberCount: number;
  kybStatus: string | null;
  agentCount: number;
  agents: OrganizationAgentPreview[];
  apiKeyCount: number;
  activeApiKeyCount: number;
  apiKeys: OrganizationApiKeyPreview[];
};

export async function getOrganizationsAction(): Promise<
  | { success: true; data: OrganizationInfo[] }
  | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const members = await prisma.member.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const organizations = members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }));

    return { success: true, data: organizations };
  } catch (error) {
    console.error("Failed to get organizations:", error);
    return {
      success: false,
      error: "Failed to load organizations",
    };
  }
}

export async function getOrganizationBySlugAction(
  slug: string,
): Promise<
  { success: true; data: OrganizationInfo } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const normalizedSlug = decodeURIComponent(slug).trim();

    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        organization: { slug: normalizedSlug },
      },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!member) {
      return { success: false, error: "Organization not found" };
    }

    return {
      success: true,
      data: {
        id: member.organization.id,
        name: member.organization.name,
        slug: member.organization.slug,
        role: member.role,
      },
    };
  } catch (error) {
    console.error("Failed to get organization:", error);
    return {
      success: false,
      error: "Failed to load organization",
    };
  }
}

export async function getOrganizationDashboardAction(
  slug: string,
): Promise<
  | { success: true; data: OrganizationDashboardData }
  | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const normalizedSlug = decodeURIComponent(slug).trim();

    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        organization: { slug: normalizedSlug },
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            kybVerification: { select: { status: true } },
          },
        },
      },
    });

    if (!member) {
      return { success: false, error: "Organization not found" };
    }

    const organizationId = member.organization.id;

    const [
      memberCount,
      apiKeyCount,
      activeApiKeyCount,
      agentCount,
      agents,
      apiKeys,
    ] = await Promise.all([
      prisma.member.count({ where: { organizationId } }),
      prisma.orgApiKey.count({ where: { organizationId } }),
      prisma.orgApiKey.count({ where: { organizationId, enabled: true } }),
      prisma.agent.count({ where: { organizationId } }),
      prisma.agent.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          icon: true,
          verificationStatus: true,
          registrationState: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.orgApiKey.findMany({
        where: { organizationId },
        select: { id: true, name: true, keyPrefix: true, enabled: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      success: true,
      data: {
        organization: {
          id: member.organization.id,
          name: member.organization.name,
          slug: member.organization.slug,
          role: member.role,
        },
        memberCount,
        kybStatus: member.organization.kybVerification?.status ?? null,
        agentCount,
        agents,
        apiKeyCount,
        activeApiKeyCount,
        apiKeys,
      },
    };
  } catch (error) {
    console.error("Failed to get organization dashboard:", error);
    return {
      success: false,
      error: "Failed to load organization dashboard",
    };
  }
}
