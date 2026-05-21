import "server-only";

import { cache } from "react";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
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
 *
 * Wrapped in React `cache()` so RSC pages that call this from both
 * `generateMetadata` and the page body (e.g. ai-agents/[id]) only hit the DB
 * once per request. The cache is keyed on `agentId` and is per-request, so
 * cross-request leakage is not a concern.
 */
export const getAgent = cache(
  async (agentId: string): Promise<GetAgentResult> => {
    try {
      const { user } = await getAuthenticatedOrThrow({
        requireEmailVerified: false,
      });

      const agent = await getWalletOwnedAgentForUser({
        userId: user.id,
        agentId,
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
  },
);
