import prisma from "@masumi/database/client";

import { getKycStatusAction } from "@/lib/actions/kyc.action";
import type { DashboardOverview } from "@/lib/types/dashboard";

export async function getDashboardOverview(
  userId: string,
): Promise<DashboardOverview> {
  const [userWithOrgs, kycResult, apiKeyCount, agentCounts, agents] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          members: {
            select: {
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      getKycStatusAction(),
      prisma.apikey.count({ where: { userId } }),
      prisma.agent.groupBy({
        by: ["verificationStatus"],
        where: { userId },
        _count: true,
      }),
      prisma.agent.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          registrationState: true,
          verificationStatus: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

  if (!userWithOrgs) {
    throw new Error("User not found");
  }

  const kycData =
    kycResult.success && kycResult.data
      ? kycResult.data
      : {
          kycStatus: "PENDING" as const,
          kycCompletedAt: null,
          kycRejectionReason: null,
        };

  const agentCount = agentCounts.reduce((sum, g) => sum + g._count, 0);
  const verifiedAgentCount = agentCounts
    .filter((g) => g.verificationStatus === "VERIFIED")
    .reduce((sum, g) => sum + g._count, 0);

  const organizations = userWithOrgs.members.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));

  const agentsList = agents.map((a) => ({
    id: a.id,
    name: a.name,
    registrationState: a.registrationState,
    verificationStatus: a.verificationStatus,
  }));

  return {
    user: {
      id: userWithOrgs.id,
      name: userWithOrgs.name,
      email: userWithOrgs.email,
      emailVerified: userWithOrgs.emailVerified,
    },
    kycStatus: kycData.kycStatus,
    kycCompletedAt: kycData.kycCompletedAt,
    kycRejectionReason: kycData.kycRejectionReason,
    organizations,
    organizationCount: organizations.length,
    agents: agentsList,
    apiKeyCount,
    agentCount,
    verifiedAgentCount,
    balance: "0",
  };
}
