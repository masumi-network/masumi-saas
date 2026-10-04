import { resolveAgentRegistryImage } from "@/lib/agents/resolve-agent-registry-image";
import type {
  RegistryAgentIdentifierMetadata,
  RegistryEntry,
} from "@/lib/payment-node/schemas";
import {
  extractAssetName,
  extractPolicyId,
} from "@/lib/registry/version-independent-agent-id";

type StoredRegistrationPayload = {
  exampleOutputs: Array<{ name: string; url: string; mimeType: string }>;
  capabilityName: string;
  capabilityVersion: string;
};

export function shouldUseRegistryMetadataFallback(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("422") ||
    message.includes("invalid or malformed") ||
    message.includes("does not advertise any pricing")
  );
}

/** When payment-node cannot parse on-chain CIP-68 (common for x402 V2), use DB registry row. */
export function buildOnChainMetadataFromRegistryEntry(params: {
  agentIdentifier: string;
  registryEntry: RegistryEntry;
  agentApiUrl: string;
  agentIcon: string | null;
  storedRegistration?: StoredRegistrationPayload | null;
}): RegistryAgentIdentifierMetadata {
  const apiBaseUrl =
    params.registryEntry.apiBaseUrl?.trim() ||
    params.registryEntry.x402ResourcesUrl?.trim() ||
    params.agentApiUrl.trim();

  const tags =
    params.registryEntry.Tags.length > 0
      ? params.registryEntry.Tags
      : ["agent"];

  const image = resolveAgentRegistryImage(params.agentIcon);

  return {
    policyId: extractPolicyId(params.agentIdentifier),
    assetName: extractAssetName(params.agentIdentifier),
    agentIdentifier: params.agentIdentifier,
    Metadata: {
      name: params.registryEntry.name,
      description: params.registryEntry.description ?? undefined,
      apiBaseUrl,
      metadataVersion: 2,
      Tags: tags,
      ...(image ? { image } : {}),
      ...(params.storedRegistration?.exampleOutputs?.length
        ? { ExampleOutputs: params.storedRegistration.exampleOutputs }
        : {}),
      Capability: {
        name:
          params.storedRegistration?.capabilityName ??
          params.registryEntry.Capability.name ??
          "unknown",
        version:
          params.storedRegistration?.capabilityVersion ??
          params.registryEntry.Capability.version ??
          "1.0.0",
      },
      AgentPricing: null,
      verifications: null,
    },
  };
}
