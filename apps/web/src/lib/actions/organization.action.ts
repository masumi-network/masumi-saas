"use server";

import prisma from "@masumi/database/client";

import { auth } from "@/lib/auth/auth";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

/** Roles that can be set via invite or role update (never "owner"). */
const ALLOWED_MEMBER_ROLES = ["member", "admin"] as const;

function parseMemberRole(role: string): "member" | "admin" | null {
  if (
    ALLOWED_MEMBER_ROLES.includes(role as (typeof ALLOWED_MEMBER_ROLES)[number])
  ) {
    return role as "member" | "admin";
  }
  return null;
}

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

// ─── Member Management Types ──────────────────────────────────────────────────

export type OrgMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
};

export type OrgInvitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  inviterName: string;
};

export type InvitationDetails = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
};

// ─── Member Management Actions ────────────────────────────────────────────────

export async function getOrganizationMembersAction(
  slug: string,
): Promise<
  { success: true; data: OrgMember[] } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const normalizedSlug = decodeURIComponent(slug).trim();

    const currentMember = await prisma.member.findFirst({
      where: { userId: user.id, organization: { slug: normalizedSlug } },
      select: { organizationId: true },
    });

    if (!currentMember) {
      return { success: false, error: "Organization not found" };
    }

    const members = await prisma.member.findMany({
      where: { organizationId: currentMember.organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      data: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    };
  } catch (error) {
    console.error("Failed to get organization members:", error);
    return { success: false, error: "Failed to load members" };
  }
}

export async function getOrganizationPendingInvitationsAction(
  slug: string,
): Promise<
  { success: true; data: OrgInvitation[] } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const normalizedSlug = decodeURIComponent(slug).trim();

    const currentMember = await prisma.member.findFirst({
      where: { userId: user.id, organization: { slug: normalizedSlug } },
      select: { organizationId: true, role: true },
    });

    if (!currentMember) {
      return { success: false, error: "Organization not found" };
    }

    // Only admin/owner can see pending invitations
    if (currentMember.role !== "owner" && currentMember.role !== "admin") {
      return { success: true, data: [] };
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: currentMember.organizationId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      include: { inviter: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    });

    return {
      success: true,
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        inviterName: inv.inviter.name,
      })),
    };
  } catch (error) {
    console.error("Failed to get pending invitations:", error);
    return { success: false, error: "Failed to load invitations" };
  }
}

export async function inviteMemberAction(input: {
  organizationId: string;
  email: string;
  role: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const role = parseMemberRole(input.role);
  if (!role) {
    return { success: false, error: "Invalid role" };
  }
  try {
    const { headers: headersList } = await getAuthenticatedOrThrow();
    await auth.api.createInvitation({
      headers: headersList,
      body: {
        email: input.email,
        role,
        organizationId: input.organizationId,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to invite member:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send invitation";
    return { success: false, error: message };
  }
}

export async function updateMemberRoleAction(input: {
  memberId: string;
  role: string;
  organizationId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const role = parseMemberRole(input.role);
  if (!role) {
    return { success: false, error: "Invalid role" };
  }
  try {
    const { headers: headersList } = await getAuthenticatedOrThrow();
    await auth.api.updateMemberRole({
      headers: headersList,
      body: {
        memberId: input.memberId,
        role,
        organizationId: input.organizationId,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to update member role:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update role";
    return { success: false, error: message };
  }
}

export async function removeMemberAction(input: {
  memberId: string;
  organizationId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { headers: headersList } = await getAuthenticatedOrThrow();
    // ⚠️ field is memberIdOrEmail, NOT memberId
    await auth.api.removeMember({
      headers: headersList,
      body: {
        memberIdOrEmail: input.memberId,
        organizationId: input.organizationId,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to remove member:", error);
    const message =
      error instanceof Error ? error.message : "Failed to remove member";
    return { success: false, error: message };
  }
}

export async function cancelInvitationAction(input: {
  invitationId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { headers: headersList } = await getAuthenticatedOrThrow();
    await auth.api.cancelInvitation({
      headers: headersList,
      body: { invitationId: input.invitationId },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to cancel invitation";
    return { success: false, error: message };
  }
}

export async function acceptInvitationAction(
  invitationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { headers: headersList } = await getAuthenticatedOrThrow();
    await auth.api.acceptInvitation({
      headers: headersList,
      body: { invitationId },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to accept invitation";
    return { success: false, error: message };
  }
}

export async function rejectInvitationAction(
  invitationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { headers: headersList } = await getAuthenticatedOrThrow();
    await auth.api.rejectInvitation({
      headers: headersList,
      body: { invitationId },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to reject invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reject invitation";
    return { success: false, error: message };
  }
}

export async function getInvitationAction(
  invitationId: string,
): Promise<
  { success: true; data: InvitationDetails } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();

    // Fetch directly from DB — Better Auth's getInvitation API only allows
    // the recipient to call it, which breaks the flow for inviters or any
    // authenticated user opening the link before switching accounts.
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: { select: { name: true, slug: true } },
        inviter: { select: { email: true } },
      },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Only the invitee or an org member may view invitation details
    const isRecipient =
      user.email?.toLowerCase() === invitation.email.toLowerCase();
    const isOrgMember = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });
    if (!isRecipient && !isOrgMember) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      return { success: false, error: "Invitation not found" };
    }

    return {
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role ?? null,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        organizationName: invitation.organization.name,
        organizationSlug: invitation.organization.slug,
        inviterEmail: invitation.inviter.email,
      },
    };
  } catch (error) {
    console.error("Failed to get invitation:", error);
    return { success: false, error: "Invitation not found" };
  }
}
