import "server-only";

import prisma from "@masumi/database/client";

import type { Agent } from "@/lib/api/agent.types";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import type { AgentPricing } from "@/lib/utils";

export type GetAgentResult =
  | { success: true; data: Agent }
  | { success: false; error: string };

/**
 * Server function for internal use (RSC, server actions). Fetches a single
 * agent for the current user with metadata merged from agent reference.
 * Prefer this over client fetch for typesafety.
 */
export async function getAgent(agentId: string): Promise<GetAgentResult> {
  try {
    const { user } = await getAuthenticatedOrThrow({
      requireEmailVerified: false,
    });

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
      include: { agentReference: true },
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    const shapedAgent = shapeAgentWithMergedMetadata(agent);
    const pricing = shapedAgent.pricing as AgentPricing | null | undefined;
    const allowedStatuses = [
      "PENDING",
      "VERIFIED",
      "REVOKED",
      "EXPIRED",
    ] as const;
    const verificationStatus =
      shapedAgent.verificationStatus &&
      allowedStatuses.includes(
        shapedAgent.verificationStatus as (typeof allowedStatuses)[number],
      )
        ? (shapedAgent.verificationStatus as Agent["verificationStatus"])
        : null;
    const data: Agent = {
      ...shapedAgent,
      pricing: pricing ?? null,
      verificationStatus,
    };

    return { success: true, data };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to get agent" };
  }
}
