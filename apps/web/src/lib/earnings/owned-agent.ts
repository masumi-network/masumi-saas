import "server-only";

import prisma from "@masumi/database/client";

import { type Network, toNetwork } from "@/lib/payment-node/format";

export async function getUserOwnedAgentForEarnings(params: {
  userId: string;
  agentId: string;
}) {
  return prisma.agent.findFirst({
    where: {
      id: params.agentId,
      userId: params.userId,
    },
    include: {
      agentReference: true,
    },
  });
}

export async function listUserOwnedAgentsForEarnings(params: {
  userId: string;
  network?: Network;
}) {
  const agents = await prisma.agent.findMany({
    where: {
      userId: params.userId,
    },
    include: {
      agentReference: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!params.network) {
    return agents;
  }

  return agents.filter(
    (agent) =>
      toNetwork(
        agent.agentReference?.networkIdentifier ?? agent.networkIdentifier,
      ) === params.network,
  );
}
