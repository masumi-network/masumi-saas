export function getAgentSmartContractAddress(agent: {
  agentReference?: { metadata?: unknown } | null;
}): string | undefined {
  const meta = agent.agentReference?.metadata;
  if (meta && typeof meta === "object" && "smartContractAddress" in meta) {
    const value = (meta as Record<string, unknown>).smartContractAddress;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
