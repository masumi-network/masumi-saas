import type { RegistryEntry } from "@/lib/payment-node/schemas";

export function resolveRegistryEntryApiUrl(entry: RegistryEntry): string {
  return entry.apiBaseUrl?.trim() || entry.x402ResourcesUrl?.trim() || "";
}

export type AgentDisplayFields = {
  name: string;
  description: string | null;
  tags: string[];
  apiUrl: string;
};

export function agentDisplayFieldsFromRegistryEntry(
  entry: RegistryEntry,
): AgentDisplayFields {
  return {
    name: entry.name,
    description: entry.description,
    tags: entry.Tags.length > 0 ? entry.Tags : ["agent"],
    apiUrl: resolveRegistryEntryApiUrl(entry),
  };
}

export function agentDisplayFieldsDiffer(
  agent: AgentDisplayFields,
  fromRegistry: AgentDisplayFields,
): boolean {
  return (
    agent.name !== fromRegistry.name ||
    (agent.description ?? "") !== (fromRegistry.description ?? "") ||
    agent.apiUrl !== fromRegistry.apiUrl ||
    JSON.stringify(agent.tags) !== JSON.stringify(fromRegistry.tags)
  );
}

/** Payment-node registry row carries pending metadata during update lifecycle. */
export function shouldSyncAgentDisplayFromRegistry(
  entry: RegistryEntry,
  agentIdentifierChanged: boolean,
): boolean {
  if (agentIdentifierChanged) {
    return true;
  }
  return (
    entry.state === "UpdateRequested" ||
    entry.state === "UpdateInitiated" ||
    entry.state === "UpdateConfirmed"
  );
}

export function mergeRegistrationPayloadFromRegistry(
  metadata: Record<string, unknown>,
  entry: RegistryEntry,
): Record<string, unknown> {
  const existingPayload =
    (metadata.registrationPayload as Record<string, unknown> | undefined) ?? {};
  const capabilityName =
    entry.Capability.name ??
    (existingPayload.capabilityName as string | undefined);
  const capabilityVersion =
    entry.Capability.version ??
    (existingPayload.capabilityVersion as string | undefined);

  if (
    capabilityName === existingPayload.capabilityName &&
    capabilityVersion === existingPayload.capabilityVersion
  ) {
    return metadata;
  }

  return {
    ...metadata,
    registrationPayload: {
      ...existingPayload,
      ...(capabilityName ? { capabilityName } : {}),
      ...(capabilityVersion ? { capabilityVersion } : {}),
    },
  };
}
