import "server-only";

import prisma from "@masumi/database/client";

import {
  isUpdateRequestedStale,
  STALE_UPDATE_REQUESTED_MS,
} from "@/lib/agents/registration-state";
import { resolveAgentRegistryImage } from "@/lib/agents/resolve-agent-registry-image";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type {
  PaymentNodeNetwork,
  UpdateAgentInput,
} from "@/lib/payment-node/schemas";
import { buildUpdateAgentInput } from "@/lib/registry/build-update-agent-input";
import { getOnChainVerifications } from "@/lib/registry/on-chain-verifications";
import { pollRegistryUpdate } from "@/lib/registry/poll-registry-update";
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
): UpdateAgentInput["Legal"] | undefined {
  const privacyPolicy = body.privacyPolicyUrl?.trim() || undefined;
  const terms = body.termsOfUseUrl?.trim() || undefined;
  const other = body.otherUrl?.trim() || undefined;

  if (!privacyPolicy && !terms && !other) {
    return undefined;
  }

  return {
    ...(privacyPolicy ? { privacyPolicy } : {}),
    ...(terms ? { terms } : {}),
    ...(other ? { other } : {}),
  };
}

function applyUserOverrides(
  updateBody: UpdateAgentInput,
  body: UpdateAgentDetailsBody,
  tagsArray: string[],
  icon: string | null | undefined,
): UpdateAgentInput {
  const image = resolveAgentRegistryImage(body.icon ?? icon);
  const legal = buildLegalFields(body);

  return {
    ...updateBody,
    name: body.name.trim(),
    description: body.description?.trim() ?? "",
    apiBaseUrl: body.apiUrl.trim(),
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
  let parsed: Record<string, unknown> = {};
  if (existingMetadata) {
    try {
      const json = JSON.parse(existingMetadata) as unknown;
      const result = agentMetadataSchema.safeParse(json);
      if (result.success) {
        parsed = result.data as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }

  const next = {
    ...parsed,
    termsOfUseUrl: body.termsOfUseUrl?.trim() || undefined,
    privacyPolicyUrl: body.privacyPolicyUrl?.trim() || undefined,
    otherUrl: body.otherUrl?.trim() || undefined,
    capabilityName: body.capabilityName?.trim() || undefined,
    capabilityVersion: body.capabilityVersion?.trim() || undefined,
    exampleOutputs: body.exampleOutputs,
  };

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
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

  const onChainMetadata = await adminClient.getRegistryByAgentIdentifier({
    agentIdentifier: agent.agentIdentifier,
    network,
  });
  if (!onChainMetadata) {
    return {
      success: false,
      error: "On-chain registry metadata could not be loaded",
    };
  }

  const verifications = getOnChainVerifications(onChainMetadata) ?? [];

  const updateBody = applyUserOverrides(
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
  );

  const previousAgentIdentifier = agent.agentIdentifier;

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

  try {
    await adminClient.updateAgent(updateBody);
  } catch (error) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        registrationState:
          registryEntry.state === "UpdateFailed"
            ? "UpdateFailed"
            : "RegistrationConfirmed",
      },
    });
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

  const pollResult = await pollRegistryUpdate(
    adminClient,
    registryId,
    network,
    previousAgentIdentifier,
    smartContractAddress,
    { allowSameIdentifierSuccess: true },
  );

  if ("error" in pollResult) {
    console.error("[Registry] Agent details update poll failed:", {
      agentId: params.agentId,
      userId: params.userId,
      error: pollResult.error,
    });

    try {
      const failedEntry = await adminClient.getRegistryById({
        id: registryId,
        network,
        filterSmartContractAddress: smartContractAddress,
      });
      if (failedEntry?.state === "UpdateFailed") {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { registrationState: "UpdateFailed" },
        });
        return { success: false, error: pollResult.error };
      }
    } catch (error) {
      console.error("[Registry] Failed to reconcile registry row after poll:", {
        agentId: params.agentId,
        userId: params.userId,
        error,
      });
    }

    try {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { registrationState: "RegistrationConfirmed" },
      });
    } catch (error) {
      console.error(
        "[Registry] Failed to reset registrationState after poll error:",
        { agentId: params.agentId, userId: params.userId, error },
      );
    }

    return { success: false, error: pollResult.error };
  }

  const existingPayload = refMeta.registrationPayload;
  const nextRegistrationPayload: StoredRegistrationPayload = {
    exampleOutputs:
      params.body.exampleOutputs ??
      existingPayload?.exampleOutputs ??
      updateBody.ExampleOutputs ??
      [],
    capabilityName:
      params.body.capabilityName?.trim() ||
      existingPayload?.capabilityName ||
      updateBody.Capability.name,
    capabilityVersion:
      params.body.capabilityVersion?.trim() ||
      existingPayload?.capabilityVersion ||
      updateBody.Capability.version,
    authorName: existingPayload?.authorName ?? updateBody.Author.name,
    authorEmail: existingPayload?.authorEmail,
    organization: existingPayload?.organization,
    contactOther: existingPayload?.contactOther,
    termsOfUseUrl: params.body.termsOfUseUrl?.trim() || undefined,
    privacyPolicyUrl: params.body.privacyPolicyUrl?.trim() || undefined,
    otherUrl: params.body.otherUrl?.trim() || undefined,
    agentPricing: existingPayload?.agentPricing ??
      updateBody.AgentPricing ?? { pricingType: "Free" },
  };

  const metadataJson = buildAgentMetadataJson(agent.metadata, params.body);

  await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: {
        name: params.body.name.trim(),
        description: params.body.description?.trim() || null,
        apiUrl: params.body.apiUrl.trim(),
        tags: tagsArray,
        icon: params.body.icon ?? agent.icon,
        agentIdentifier: pollResult.agentIdentifier,
        registrationState: "RegistrationConfirmed",
        metadata: metadataJson,
      },
    }),
    prisma.agentReference.update({
      where: { agentId: agent.id },
      data: {
        metadata: {
          ...refMeta,
          agentIdentifier: pollResult.agentIdentifier,
          registrationPayload: nextRegistrationPayload,
        },
      },
    }),
  ]);

  return {
    success: true,
    agentId: agent.id,
    agentIdentifier: pollResult.agentIdentifier,
  };
}
