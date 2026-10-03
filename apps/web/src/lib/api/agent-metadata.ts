import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";

import { getAgentPayoutAddress } from "@/lib/agents/agent-reference-metadata";
import {
  agentMetadataSchema,
  agentPricingRequiresPayoutAddress,
} from "@/lib/schemas/agent";
import {
  isX402RegistryAgent,
  parseAgentRegistryMetadata,
} from "@/lib/x402/agent-registry-metadata";

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

function shouldExposePayoutAddressToClient(
  pricing: { pricingType?: string } | null | undefined,
  metadata: string | null,
): boolean {
  if (!agentPricingRequiresPayoutAddress(pricing)) {
    return false;
  }
  const registryMeta = parseAgentRegistryMetadata(metadata);
  if (isX402RegistryAgent(registryMeta)) {
    return false;
  }
  return true;
}

export function shapeAgentForApi<T extends AgentMetadataSource>(
  agent: T,
  supportedPaymentSources?: SupportedPaymentSource[] | null,
) {
  const shaped = shapeAgentWithMergedMetadata(agent);
  const pricing = shaped.pricing as { pricingType?: string } | null | undefined;
  const collectionAddress = getAgentPayoutAddress(agent);

  return {
    ...shaped,
    supportedPaymentSources: supportedPaymentSources ?? null,
    payoutAddress: shouldExposePayoutAddressToClient(pricing, shaped.metadata)
      ? collectionAddress
      : null,
  };
}
