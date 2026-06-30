import type {
  PaymentNodeNetwork,
  RegistryAgentIdentifierMetadata,
  RegistryEntry,
  UpdateAgentInput,
} from "@/lib/payment-node/schemas";
import type { Verification } from "@/lib/payment-node/verification-schemas";

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
  verifications: Verification[];
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

export function buildUpdateAgentInput(
  params: BuildUpdateAgentInputParams,
): UpdateAgentInput {
  const { registryEntry, onChainMetadata, storedRegistration } = params;
  const metadata = onChainMetadata.Metadata;

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

  return {
    network: params.network,
    agentIdentifier: params.agentIdentifier,
    ...(params.smartContractAddress
      ? { smartContractAddress: params.smartContractAddress }
      : {}),
    name: metadata.name ?? registryEntry.name,
    apiBaseUrl: metadata.apiBaseUrl ?? registryEntry.apiBaseUrl,
    description: metadata.description ?? registryEntry.description ?? "",
    Tags:
      metadata.Tags && metadata.Tags.length > 0
        ? metadata.Tags
        : registryEntry.Tags,
    ExampleOutputs: exampleOutputs,
    Capability: {
      name: capability.name,
      version: capability.version,
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
    AgentPricing: (metadata.AgentPricing ??
      storedRegistration?.agentPricing ??
      registryEntry.AgentPricing) as UpdateAgentInput["AgentPricing"],
    verifications: params.verifications,
  };
}
