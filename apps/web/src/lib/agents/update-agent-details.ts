import "server-only";

import prisma from "@masumi/database/client";

import {
  buildOnChainMetadataFromRegistryEntry,
  shouldUseRegistryMetadataFallback,
} from "@/lib/agents/build-on-chain-metadata-fallback";
import {
  isUpdateRequestedStale,
  STALE_UPDATE_REQUESTED_MS,
  withoutRegistryUpdateBaseline,
  withRegistryUpdateBaseline,
} from "@/lib/agents/registration-state";
import { resolveAgentRegistryImage } from "@/lib/agents/resolve-agent-registry-image";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type {
  PaymentNodeNetwork,
  RegistryEntryType,
  UpdateAgentInput,
} from "@/lib/payment-node/schemas";
import { buildUpdateAgentInput } from "@/lib/registry/build-update-agent-input";
import { getOnChainVerifications } from "@/lib/registry/on-chain-verifications";
import { resolveRegistryEntryType } from "@/lib/registry/resolve-registry-entry-type";
import {
  extractAssetName,
  isV2RegistryAssetName,
} from "@/lib/registry/version-independent-agent-id";
import type { updateAgentDetailsBodySchema } from "@/lib/schemas/agent";
import { agentMetadataSchema } from "@/lib/schemas/agent";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import type { z } from "@/lib/zod-openapi";

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";

type UpdateAgentDetailsBody = z.infer<typeof updateAgentDetailsBodySchema>;

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

type RegistrationRefMetadata = {
  smartContractAddress?: string;
  registrationPayload?: StoredRegistrationPayload;
  agentIdentifier?: string;
};

export type UpdateAgentDetailsResult =
  | { success: true; agentId: string; agentIdentifier: string }
  | { success: false; error: string };

function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function buildLegalFields(
  body: UpdateAgentDetailsBody,
  existing: UpdateAgentInput["Legal"],
): UpdateAgentInput["Legal"] | undefined {
  const next = { ...existing };
  const fields = [
    ["privacyPolicyUrl", "privacyPolicy"],
    ["termsOfUseUrl", "terms"],
    ["otherUrl", "other"],
  ] as const;
  let changed = false;
  for (const [input, field] of fields) {
    if (body[input] === undefined) continue;
    changed = true;
    const value = body[input].trim();
    if (value) next[field] = value;
    else delete next[field];
  }
  return changed || existing ? next : undefined;
}

function applyRegistryUrlOverride(
  entryType: RegistryEntryType,
  apiUrl: string,
): Pick<
  UpdateAgentInput,
  "type" | "apiBaseUrl" | "x402ResourcesUrl" | "openApiSpecUrl"
> {
  const trimmed = apiUrl.trim();
  if (entryType === "X402") {
    return { type: "X402" };
  }
  if (entryType === "OpenApi") {
    return { type: "OpenApi", openApiSpecUrl: trimmed };
  }
  return { apiBaseUrl: trimmed };
}

function applyUserOverrides(
  updateBody: UpdateAgentInput,
  body: UpdateAgentDetailsBody,
  tagsArray: string[],
  icon: string | null | undefined,
  entryType: RegistryEntryType,
): UpdateAgentInput {
  const image = resolveAgentRegistryImage(body.icon ?? icon);
  const legal = buildLegalFields(body, updateBody.Legal);

  return {
    ...updateBody,
    name: body.name.trim(),
    description: body.description?.trim() ?? "",
    ...applyRegistryUrlOverride(entryType, body.apiUrl),
    Tags: tagsArray,
    ...(image ? { image } : {}),
    Capability: {
      name:
        body.capabilityName?.trim() || updateBody.Capability.name || "unknown",
      version:
        body.capabilityVersion?.trim() ||
        updateBody.Capability.version ||
        "1.0.0",
    },
    ...(body.exampleOutputs !== undefined
      ? { ExampleOutputs: body.exampleOutputs }
      : {}),
    ...(legal ? { Legal: legal } : {}),
  };
}

function buildAgentMetadataJson(
  existingMetadata: string | null,
  body: UpdateAgentDetailsBody,
): string | null {
  let parsed: z.infer<typeof agentMetadataSchema> = {};
  if (existingMetadata) {
    try {
      const json = JSON.parse(existingMetadata) as unknown;
      const result = agentMetadataSchema.safeParse(json);
      if (result.success) {
        parsed = result.data;
      }
    } catch {
      parsed = {};
    }
  }

  const next: Record<string, unknown> = { ...parsed };
  for (const key of [
    "termsOfUseUrl",
    "privacyPolicyUrl",
    "otherUrl",
    "capabilityName",
    "capabilityVersion",
  ] as const) {
    if (body[key] !== undefined) next[key] = body[key].trim() || undefined;
  }
  if (body.exampleOutputs !== undefined)
    next.exampleOutputs = body.exampleOutputs;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

function buildNextRegistrationPayload(params: {
  body: UpdateAgentDetailsBody;
  existingPayload: StoredRegistrationPayload | undefined;
  updateBody: UpdateAgentInput;
}): StoredRegistrationPayload {
  const { body, existingPayload, updateBody } = params;
  return {
    exampleOutputs:
      body.exampleOutputs ??
      existingPayload?.exampleOutputs ??
      updateBody.ExampleOutputs ??
      [],
    capabilityName:
      body.capabilityName?.trim() ||
      existingPayload?.capabilityName ||
      updateBody.Capability.name,
    capabilityVersion:
      body.capabilityVersion?.trim() ||
      existingPayload?.capabilityVersion ||
      updateBody.Capability.version,
    authorName: existingPayload?.authorName ?? updateBody.Author.name,
    authorEmail: existingPayload?.authorEmail,
    organization: existingPayload?.organization,
    contactOther: existingPayload?.contactOther,
    termsOfUseUrl: updateBody.Legal?.terms,
    privacyPolicyUrl: updateBody.Legal?.privacyPolicy,
    otherUrl: updateBody.Legal?.other,
    agentPricing: existingPayload?.agentPricing ??
      updateBody.AgentPricing ?? { pricingType: "Free" },
  };
}

async function resolveSmartContractAddress(params: {
  adminClient: NonNullable<ReturnType<typeof tryCreateAdminPaymentNodeClient>>;
  userId: string;
  network: PaymentNodeNetwork;
  refMeta: RegistrationRefMetadata;
}): Promise<string | undefined> {
  if (typeof params.refMeta.smartContractAddress === "string") {
    return params.refMeta.smartContractAddress;
  }

  const fromEnv = paymentNodeConfig.tryGetSmartContractAddress(params.network);
  if (fromEnv) return fromEnv;

  return (
    (await getSmartContractAddressForConfiguredSource(
      params.adminClient,
      params.userId,
      params.network,
    )) ?? undefined
  );
}

export async function updateAgentDetails(params: {
  userId: string;
  agentId: string;
  body: UpdateAgentDetailsBody;
}): Promise<UpdateAgentDetailsResult> {
  const tagsArray = parseTags(params.body.tags);
  if (tagsArray.length === 0) {
    return { success: false, error: "At least one tag is required." };
  }

  try {
    await assertAllowedAgentApiUrl(params.body.apiUrl.trim());
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid API URL",
    };
  }

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, userId: params.userId },
    include: { agentReference: true },
  });

  if (!agent?.agentReference?.externalId || !agent.agentIdentifier) {
    return {
      success: false,
      error: "Agent is not registered on the payment node",
    };
  }

  if (!isV2RegistryAssetName(extractAssetName(agent.agentIdentifier))) {
    return {
      success: false,
      error: "Agent details updates require a V2 registry entry",
    };
  }

  const isStaleUpdateRequested =
    agent.registrationState === "UpdateRequested" &&
    isUpdateRequestedStale({
      registrationState: agent.registrationState,
      updatedAt: agent.updatedAt,
    });

  const canProceed =
    agent.registrationState === "RegistrationConfirmed" ||
    agent.registrationState === "UpdateFailed" ||
    isStaleUpdateRequested;

  if (!canProceed) {
    if (
      agent.registrationState === "UpdateRequested" ||
      agent.registrationState === "UpdateInitiated"
    ) {
      return {
        success: false,
        error:
          "An agent update is already in progress. Please try again later.",
      };
    }
    return {
      success: false,
      error: "Agent details cannot be updated in the current state",
    };
  }

  const adminClient = tryCreateAdminPaymentNodeClient();
  if (!adminClient) {
    return {
      success: false,
      error: "Payment node is unavailable. Please try again later.",
    };
  }

  const network = (agent.agentReference.networkIdentifier ??
    agent.networkIdentifier ??
    DEFAULT_NETWORK) as PaymentNodeNetwork;
  const registryId = agent.agentReference.externalId;
  const refMeta = (agent.agentReference.metadata ??
    {}) as RegistrationRefMetadata;

  const smartContractAddress = await resolveSmartContractAddress({
    adminClient,
    userId: params.userId,
    network,
    refMeta,
  });

  const registryEntry = await adminClient.getRegistryById({
    id: registryId,
    network,
    filterSmartContractAddress: smartContractAddress,
  });
  if (!registryEntry) {
    return { success: false, error: "Registry entry not found" };
  }

  if (
    resolveRegistryEntryType(registryEntry) === "X402" &&
    params.body.apiUrl.trim() !== agent.apiUrl.trim()
  ) {
    return {
      success: false,
      error: "The resource URL of a registered x402 agent cannot be changed.",
    };
  }

  let onChainMetadata;
  try {
    onChainMetadata = await adminClient.getRegistryByAgentIdentifier({
      agentIdentifier: agent.agentIdentifier,
      network,
    });
  } catch (error) {
    if (shouldUseRegistryMetadataFallback(error)) {
      console.warn(
        "[Registry] Using registry row fallback for edit metadata (on-chain parse failed):",
        {
          agentId: params.agentId,
          agentIdentifier: agent.agentIdentifier,
          network,
          error: error instanceof Error ? error.message : error,
        },
      );
      onChainMetadata = buildOnChainMetadataFromRegistryEntry({
        agentIdentifier: agent.agentIdentifier,
        registryEntry,
        agentApiUrl: agent.apiUrl,
        agentIcon: agent.icon,
        storedRegistration: refMeta.registrationPayload ?? null,
      });
    } else {
      console.error("[Registry] Failed to load on-chain metadata for edit:", {
        agentId: params.agentId,
        userId: params.userId,
        agentIdentifier: agent.agentIdentifier,
        network,
        error,
      });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "On-chain registry metadata could not be loaded",
      };
    }
  }
  if (!onChainMetadata) {
    onChainMetadata = buildOnChainMetadataFromRegistryEntry({
      agentIdentifier: agent.agentIdentifier,
      registryEntry,
      agentApiUrl: agent.apiUrl,
      agentIcon: agent.icon,
      storedRegistration: refMeta.registrationPayload ?? null,
    });
  }

  const onChainVerifications = getOnChainVerifications(onChainMetadata);
  const verifications =
    onChainVerifications ?? registryEntry.verifications ?? undefined;

  const updateBody = {
    ...applyUserOverrides(
      buildUpdateAgentInput({
        network,
        agentIdentifier: agent.agentIdentifier,
        smartContractAddress,
        registryEntry,
        onChainMetadata,
        storedRegistration: refMeta.registrationPayload ?? null,
        agentIcon: params.body.icon ?? agent.icon,
        verifications,
      }),
      params.body,
      tagsArray,
      agent.icon,
      resolveRegistryEntryType(registryEntry),
    ),
    sendFundingLovelace:
      paymentNodeConfig.getRegistryHoldingWalletFundingLovelace(),
  };

  const registryRowUpdatedBefore = registryEntry.updatedAt;

  const staleUpdateRequestedBefore = new Date(
    Date.now() - STALE_UPDATE_REQUESTED_MS,
  );
  const lock = await prisma.agent.updateMany({
    where: {
      id: agent.id,
      userId: params.userId,
      OR: [
        {
          registrationState: { in: ["RegistrationConfirmed", "UpdateFailed"] },
        },
        {
          registrationState: "UpdateRequested",
          updatedAt: { lt: staleUpdateRequestedBefore },
        },
      ],
    },
    data: { registrationState: "UpdateRequested" },
  });

  if (lock.count === 0) {
    return {
      success: false,
      error: "An agent update is already in progress. Please try again later.",
    };
  }

  await prisma.agentReference.update({
    where: { agentId: agent.id },
    data: {
      metadata: withRegistryUpdateBaseline(
        refMeta as Record<string, unknown>,
        registryRowUpdatedBefore,
      ),
    },
  });

  try {
    await adminClient.updateAgent(updateBody);
  } catch (error) {
    await prisma.$transaction([
      prisma.agent.update({
        where: { id: agent.id },
        data: {
          registrationState:
            registryEntry.state === "UpdateFailed"
              ? "UpdateFailed"
              : "RegistrationConfirmed",
        },
      }),
      prisma.agentReference.update({
        where: { agentId: agent.id },
        data: {
          metadata: withoutRegistryUpdateBaseline(
            refMeta as Record<string, unknown>,
          ),
        },
      }),
    ]);
    console.error("[Registry] Agent details update request failed:", {
      agentId: params.agentId,
      userId: params.userId,
      error,
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to request registry update",
    };
  }

  const nextRegistrationPayload = buildNextRegistrationPayload({
    body: params.body,
    existingPayload: refMeta.registrationPayload,
    updateBody,
  });
  const metadataJson = buildAgentMetadataJson(agent.metadata, params.body);
  const refMetadataWithBaseline = withRegistryUpdateBaseline(
    refMeta as Record<string, unknown>,
    registryRowUpdatedBefore,
  );

  await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: {
        name: params.body.name.trim(),
        description: params.body.description?.trim() || null,
        apiUrl: params.body.apiUrl.trim(),
        tags: tagsArray,
        icon: params.body.icon ?? agent.icon,
        registrationState: "UpdateRequested",
        metadata: metadataJson,
      },
    }),
    prisma.agentReference.update({
      where: { agentId: agent.id },
      data: {
        metadata: {
          ...refMetadataWithBaseline,
          registrationPayload: nextRegistrationPayload,
        },
      },
    }),
  ]);

  return {
    success: true,
    agentId: agent.id,
    agentIdentifier: agent.agentIdentifier,
  };
}
