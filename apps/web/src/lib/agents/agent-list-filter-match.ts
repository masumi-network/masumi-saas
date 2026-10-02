import {
  isX402RegistryAgent,
  parseAgentRegistryMetadata,
} from "@/lib/x402/agent-registry-metadata";

export type AgentRegistrationKindFilter = "standard" | "x402";

export type AgentPricingTypeFilter = "free" | "fixed" | "dynamic";

export function classifyAgentRegistrationKind(agent: {
  metadata: string | null;
  agentReference?: { metadata: unknown } | null;
}): "STANDARD" | "X402_HTTP" {
  const parsed = parseAgentRegistryMetadata(agent.metadata);
  if (isX402RegistryAgent(parsed)) return "X402_HTTP";
  if (parsed?.registryEntryType === "X402") return "X402_HTTP";

  const ref = agent.agentReference?.metadata as
    | { registrationPayload?: { registrationKind?: string } }
    | null
    | undefined;
  if (ref?.registrationPayload?.registrationKind === "X402_HTTP") {
    return "X402_HTTP";
  }

  return "STANDARD";
}

export function classifyAgentPricingType(agent: {
  pricing: unknown;
}): "Free" | "Fixed" | "Dynamic" | null {
  const pricingType = (agent.pricing as { pricingType?: string } | null)
    ?.pricingType;
  if (
    pricingType === "Free" ||
    pricingType === "Fixed" ||
    pricingType === "Dynamic"
  ) {
    return pricingType;
  }
  return null;
}

export function matchesAgentTypeFilter(
  agent: Parameters<typeof classifyAgentRegistrationKind>[0],
  filter: AgentRegistrationKindFilter | undefined,
): boolean {
  if (!filter) return true;
  const kind = classifyAgentRegistrationKind(agent);
  if (filter === "x402") return kind === "X402_HTTP";
  return kind === "STANDARD";
}

export function matchesPricingTypeFilter(
  agent: Parameters<typeof classifyAgentPricingType>[0],
  filter: AgentPricingTypeFilter | undefined,
): boolean {
  if (!filter) return true;
  const pricingType = classifyAgentPricingType(agent);
  if (!pricingType) return false;
  const expected =
    filter === "free" ? "Free" : filter === "fixed" ? "Fixed" : "Dynamic";
  return pricingType === expected;
}
