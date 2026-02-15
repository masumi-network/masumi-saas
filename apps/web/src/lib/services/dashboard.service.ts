import prisma from "@masumi/database/client";

import { getKycStatusAction } from "@/lib/actions/kyc.action";
import type { DashboardOverview } from "@/lib/types/dashboard";

export async function getDashboardOverview(
  userId: string,
): Promise<DashboardOverview> {
  const [
    userWithOrgs,
    kycResult,
    apiKeysResult,
    apiKeyCount,
    agentCounts,
    agentRegistrationCounts,
    agents,
  ] = await Promise.all([
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
    prisma.apikey.findMany({
      where: { userId },
      select: { id: true, name: true, prefix: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.apikey.count({ where: { userId } }),
    prisma.agent.groupBy({
      by: ["verificationStatus"],
      where: { userId },
      _count: true,
    }),
    prisma.agent.groupBy({
      by: ["registrationState"],
      where: { userId },
      _count: true,
    }),
    prisma.agent.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        icon: true,
        registrationState: true,
        verificationStatus: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  if (!userWithOrgs) {
    throw new Error("User not found");
  }

  const kycData =
    kycResult.success && kycResult.data
      ? { ...kycResult.data, kycError: undefined as string | undefined }
      : {
          kycStatus: "PENDING" as const,
          kycCompletedAt: null,
          kycRejectionReason: null,
          kycError: kycResult.error ?? "Failed to load verification status",
        };

  const agentCount = agentCounts.reduce((sum, g) => sum + g._count, 0);
  const verifiedGroup = agentCounts.find(
    (g) => g.verificationStatus === "VERIFIED",
  );
  const verifiedAgentCount = verifiedGroup?._count ?? 0;

  const runningAgentCount =
    agentRegistrationCounts.find(
      (g) => g.registrationState === "RegistrationConfirmed",
    )?._count ?? 0;
  const pendingAgentCount = agentRegistrationCounts
    .filter((g) =>
      ["RegistrationRequested", "DeregistrationRequested"].includes(
        g.registrationState,
      ),
    )
    .reduce((sum, g) => sum + g._count, 0);
  const failedAgentCount = agentRegistrationCounts
    .filter((g) =>
      ["RegistrationFailed", "DeregistrationFailed"].includes(
        g.registrationState,
      ),
    )
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
    icon: a.icon,
    registrationState: a.registrationState,
    verificationStatus: a.verificationStatus,
  }));

  const apiKeysList = apiKeysResult.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
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
    kycError: kycData.kycError,
    organizations,
    organizationCount: organizations.length,
    agents: agentsList,
    apiKeys: apiKeysList,
    apiKeyCount,
    agentCount,
    verifiedAgentCount,
    runningAgentCount,
    pendingAgentCount,
    failedAgentCount,
    // TODO: Integrate real balance from payment/wallet service
    balance: "0",
  };
}
