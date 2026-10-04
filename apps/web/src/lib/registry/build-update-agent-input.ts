import { resolveAgentRegistryImage } from "@/lib/agents/resolve-agent-registry-image";
import type {
  PaymentNodeNetwork,
  RegistryAgentIdentifierMetadata,
  RegistryEntry,
  RegistryEntryType,
  UpdateAgentInput,
} from "@/lib/payment-node/schemas";
import type { Verification } from "@/lib/payment-node/verification-schemas";
import { resolveRegistryEntryType } from "@/lib/registry/resolve-registry-entry-type";

type StoredRegistrationPayload = {
  exampleOutputs: Array<{ name: string; url: string; mimeType: string }>;
  capabilityName: string;
  capabilityVersion: string;
  authorName: string;
  authorEmail?: string;
  organization?: string;
  contactOther?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
  otherUrl?: string;
  agentPricing: UpdateAgentInput["AgentPricing"];
};

type BuildUpdateAgentInputParams = {
  network: PaymentNodeNetwork;
  agentIdentifier: string;
  smartContractAddress?: string;
  registryEntry: RegistryEntry;
  onChainMetadata: RegistryAgentIdentifierMetadata;
  storedRegistration?: StoredRegistrationPayload | null;
  agentIcon?: string | null;
  /** Omit when unknown so payment-node keeps existing verification rows. */
  verifications?: Verification[];
};

function resolveLegal(
  stored: StoredRegistrationPayload | null | undefined,
  metadata: RegistryAgentIdentifierMetadata["Metadata"],
): UpdateAgentInput["Legal"] | undefined {
  const privacyPolicy =
    metadata.Legal?.privacyPolicy ?? stored?.privacyPolicyUrl ?? undefined;
  const terms = metadata.Legal?.terms ?? stored?.termsOfUseUrl ?? undefined;
  const other = metadata.Legal?.other ?? stored?.otherUrl ?? undefined;

  if (!privacyPolicy && !terms && !other) return undefined;

  return {
    ...(privacyPolicy ? { privacyPolicy } : {}),
    ...(terms ? { terms } : {}),
    ...(other ? { other } : {}),
  };
}

function isV2RegistryMetadata(
  metadata: RegistryAgentIdentifierMetadata["Metadata"],
): boolean {
  return (metadata.metadataVersion ?? 1) >= 2;
}

function resolveStandardApiBaseUrl(
  metadata: RegistryAgentIdentifierMetadata["Metadata"],
  registryEntry: RegistryEntry,
): string {
  const fromMetadata = metadata.apiBaseUrl?.trim();
  if (fromMetadata) return fromMetadata;
  return registryEntry.apiBaseUrl?.trim() ?? "";
}

function resolveX402ResourcesUrl(
  metadata: RegistryAgentIdentifierMetadata["Metadata"],
  registryEntry: RegistryEntry,
): string {
  const fromEntry = registryEntry.x402ResourcesUrl?.trim();
  if (fromEntry) return fromEntry;
  return registryEntry.apiBaseUrl?.trim() ?? "";
}

function resolveOpenApiSpecUrl(
  metadata: RegistryAgentIdentifierMetadata["Metadata"],
  registryEntry: RegistryEntry,
): string {
  return registryEntry.openApiSpecUrl?.trim() ?? "";
}

function buildRegistryEndpointFields(
  entryType: RegistryEntryType,
  metadata: RegistryAgentIdentifierMetadata["Metadata"],
  registryEntry: RegistryEntry,
): Pick<
  UpdateAgentInput,
  "type" | "apiBaseUrl" | "x402ResourcesUrl" | "openApiSpecUrl"
> {
  if (entryType === "X402") {
    return {
      type: "X402",
      x402ResourcesUrl: resolveX402ResourcesUrl(metadata, registryEntry),
    };
  }
  if (entryType === "OpenApi") {
    return {
      type: "OpenApi",
      openApiSpecUrl: resolveOpenApiSpecUrl(metadata, registryEntry),
    };
  }
  return {
    apiBaseUrl: resolveStandardApiBaseUrl(metadata, registryEntry),
  };
}

export function buildUpdateAgentInput(
  params: BuildUpdateAgentInputParams,
): UpdateAgentInput {
  const { registryEntry, onChainMetadata, storedRegistration } = params;
  const metadata = onChainMetadata.Metadata;
  const entryType = resolveRegistryEntryType(registryEntry);
  const isV2 = isV2RegistryMetadata(metadata);
  const image =
    metadata.image ?? resolveAgentRegistryImage(params.agentIcon) ?? undefined;

  const exampleOutputs =
    metadata.ExampleOutputs ?? storedRegistration?.exampleOutputs ?? [];

  const capability =
    metadata.Capability ??
    (storedRegistration
      ? {
          name: storedRegistration.capabilityName,
          version: storedRegistration.capabilityVersion,
        }
      : {
          name: registryEntry.Capability.name ?? "unknown",
          version: registryEntry.Capability.version ?? "1.0.0",
        });

  const author = metadata.Author ?? {
    name: storedRegistration?.authorName ?? registryEntry.Author.name,
    contactEmail:
      storedRegistration?.authorEmail ??
      registryEntry.Author.contactEmail ??
      undefined,
    contactOther:
      storedRegistration?.contactOther ??
      registryEntry.Author.contactOther ??
      undefined,
    organization:
      storedRegistration?.organization ??
      registryEntry.Author.organization ??
      undefined,
  };

  const base: UpdateAgentInput = {
    network: params.network,
    agentIdentifier: params.agentIdentifier,
    ...(params.smartContractAddress
      ? { smartContractAddress: params.smartContractAddress }
      : {}),
    name: metadata.name ?? registryEntry.name,
    ...buildRegistryEndpointFields(entryType, metadata, registryEntry),
    description: metadata.description ?? registryEntry.description ?? "",
    ...(image ? { image } : {}),
    Tags:
      metadata.Tags && metadata.Tags.length > 0
        ? metadata.Tags
        : registryEntry.Tags,
    ExampleOutputs: exampleOutputs,
    Capability: {
      name: capability.name ?? "unknown",
      version: capability.version ?? "1.0.0",
    },
    Author: {
      name: author.name,
      ...(author.contactEmail ? { contactEmail: author.contactEmail } : {}),
      ...(author.contactOther ? { contactOther: author.contactOther } : {}),
      ...(author.organization ? { organization: author.organization } : {}),
    },
    ...(resolveLegal(storedRegistration, metadata)
      ? { Legal: resolveLegal(storedRegistration, metadata) }
      : {}),
    ...(params.verifications !== undefined
      ? { verifications: params.verifications }
      : {}),
  };

  if (isV2) {
    return base;
  }

  return {
    ...base,
    AgentPricing: (metadata.AgentPricing ??
      storedRegistration?.agentPricing ??
      registryEntry.AgentPricing) as UpdateAgentInput["AgentPricing"],
  };
}
