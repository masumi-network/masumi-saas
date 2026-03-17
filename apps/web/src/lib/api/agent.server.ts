import "server-only";

import prisma from "@masumi/database/client";

import type { Agent } from "@/lib/api/agent.types";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { agentMetadataSchema } from "@/lib/schemas/agent";
import type { AgentPricing } from "@/lib/utils";

const METADATA_KEYS = [
  "authorName",
  "authorEmail",
  "organization",
  "contactOther",
  "termsOfUseUrl",
  "privacyPolicyUrl",
  "otherUrl",
  "capabilityName",
  "capabilityVersion",
  "exampleOutputs",
] as const;

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

    let mergedMetadata: Record<string, unknown> = {};
    if (agent.metadata) {
      try {
        const parsed = JSON.parse(agent.metadata) as unknown;
        const result = agentMetadataSchema.safeParse(parsed);
        mergedMetadata = result.success
          ? (result.data as Record<string, unknown>)
          : {};
      } catch {
        // Corrupt or non-JSON metadata
      }
    }
    const refMeta = agent.agentReference?.metadata as
      | Record<string, unknown>
      | null
      | undefined;
    const registrationPayload = refMeta?.registrationPayload as
      | Record<string, unknown>
      | undefined;
    if (registrationPayload) {
      for (const key of METADATA_KEYS) {
        if (
          registrationPayload[key] !== undefined &&
          mergedMetadata[key] === undefined
        ) {
          mergedMetadata[key] = registrationPayload[key];
        }
      }
    }

    const { agentReference: _ref, ...agentRest } = agent;
    const pricing = agentRest.pricing as AgentPricing | null | undefined;
    const allowedStatuses = [
      "PENDING",
      "VERIFIED",
      "REVOKED",
      "EXPIRED",
    ] as const;
    const verificationStatus =
      agentRest.verificationStatus &&
      allowedStatuses.includes(
        agentRest.verificationStatus as (typeof allowedStatuses)[number],
      )
        ? (agentRest.verificationStatus as Agent["verificationStatus"])
        : null;
    const data: Agent = {
      ...agentRest,
      metadata:
        Object.keys(mergedMetadata).length > 0
          ? JSON.stringify(mergedMetadata)
          : null,
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
