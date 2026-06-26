import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";

import { agentMetadataSchema } from "@/lib/schemas/agent";

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

type AgentMetadataSource = {
  metadata: string | null;
  agentReference?: { metadata: unknown } | null;
  [key: string]: unknown;
};

function parseAgentMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    const result = agentMetadataSchema.safeParse(parsed);
    return result.success ? (result.data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function mergeRegistrationPayload(
  mergedMetadata: Record<string, unknown>,
  registrationPayload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!registrationPayload) return mergedMetadata;

  for (const key of METADATA_KEYS) {
    if (
      registrationPayload[key] !== undefined &&
      mergedMetadata[key] === undefined
    ) {
      mergedMetadata[key] = registrationPayload[key];
    }
  }

  return mergedMetadata;
}

export function shapeAgentWithMergedMetadata<T extends AgentMetadataSource>(
  agent: T,
) {
  const mergedMetadata = mergeRegistrationPayload(
    parseAgentMetadata(agent.metadata),
    (
      agent.agentReference?.metadata as
        | { registrationPayload?: Record<string, unknown> }
        | null
        | undefined
    )?.registrationPayload,
  );
  const { agentReference: _ref, ...agentRest } = agent;

  return {
    ...agentRest,
    metadata:
      Object.keys(mergedMetadata).length > 0
        ? JSON.stringify(mergedMetadata)
        : null,
  };
}

export function shapeAgentForApi<T extends AgentMetadataSource>(
  agent: T,
  supportedPaymentSources?: SupportedPaymentSource[] | null,
) {
  return {
    ...shapeAgentWithMergedMetadata(agent),
    supportedPaymentSources: supportedPaymentSources ?? null,
  };
}
