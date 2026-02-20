"use server";

import prisma from "@masumi/database/client";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

export type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  role: string;
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
