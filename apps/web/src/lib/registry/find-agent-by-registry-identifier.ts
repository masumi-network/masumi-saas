import prisma from "@masumi/database/client";

import {
  extractPolicyId,
  versionIndependentAgentId,
} from "@/lib/registry/version-independent-agent-id";

type AgentRegistrySelect = {
  id: true;
  name: true;
  apiUrl: true;
  agentIdentifier: true;
  networkIdentifier: true;
  verificationStatus: true;
};

export type RegistryAgentLookup = {
  agent: {
    id: string;
    name: string;
    apiUrl: string;
    agentIdentifier: string | null;
    networkIdentifier: string | null;
    verificationStatus: string | null;
  };
  canonicalAgentIdentifier: string;
};

const VERIFICATION_AGENT_SELECT = {
  id: true,
  name: true,
  apiUrl: true,
  agentIdentifier: true,
  networkIdentifier: true,
  verificationStatus: true,
} satisfies AgentRegistrySelect;

/**
 * Resolve an agent by exact or version-independent registry identifier.
 * Returns the canonical (current) on-chain identifier when the row was bumped.
 */
export async function findAgentByRegistryIdentifier(
  agentIdentifier: string,
): Promise<RegistryAgentLookup | null> {
  const exact = await prisma.agent.findFirst({
    where: { agentIdentifier },
    select: VERIFICATION_AGENT_SELECT,
  });
  if (exact?.agentIdentifier) {
    return { agent: exact, canonicalAgentIdentifier: exact.agentIdentifier };
  }

  let policyId: string;
  let stableId: string;
  try {
    policyId = extractPolicyId(agentIdentifier);
    stableId = versionIndependentAgentId(agentIdentifier);
  } catch {
    return null;
  }

  const candidates = await prisma.agent.findMany({
    where: { agentIdentifier: { startsWith: policyId } },
    select: VERIFICATION_AGENT_SELECT,
  });

  const match = candidates.find((candidate) => {
    if (!candidate.agentIdentifier) return false;
    try {
      return versionIndependentAgentId(candidate.agentIdentifier) === stableId;
    } catch {
      return false;
    }
  });

  if (!match?.agentIdentifier) {
    return null;
  }

  return { agent: match, canonicalAgentIdentifier: match.agentIdentifier };
}
