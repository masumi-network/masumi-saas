import prisma from "@masumi/database/client";

import {
  type RegisterAgentContext,
  startAgentRegistration,
  validateAgentRegistrationPaymentSourcesPreflight,
} from "@/lib/agent-registration";
import { X402_RESOURCE_URL_BLOCKED_STATES } from "@/lib/agents/registration-state";
import {
  consumeCreditIfRequired,
  createCreditReference,
  refundConsumedCredit,
} from "@/lib/credits/service";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import {
  buildX402ResourceAutofill,
  suggestedNameFromResourceUrl,
} from "@/lib/x402/resource-autofill";

import { MAX_BATCH_RESOURCE_URLS } from "./parse-batch-resource-urls";
import { prepareX402HttpRegistration } from "./prepare-http-registration";
import { resourceUrlDuplicateKey } from "./resource-url-duplicate-key";

export const BATCH_X402_REGISTRATION_MAX_URLS = MAX_BATCH_RESOURCE_URLS;

export type StartX402HttpAgentRegistrationInput = {
  ctx: RegisterAgentContext;
  resourceUrl: string;
  name?: string;
  description?: string;
  tags?: string[];
  icon?: string | null;
  skipIfDuplicate?: boolean;
  authMethod?: string;
  /** When false, name/description/tags ignore probe-derived autofill defaults. */
  useProbeMetadataAutofill?: boolean;
};

export type StartX402HttpAgentRegistrationResult =
  | { ok: true; agentId: string; resourceUrl: string }
  | {
      ok: false;
      resourceUrl: string;
      error: string;
      code?: "duplicate" | "validation" | "credits" | "registration";
    };

function mergeTags(
  autofillTags: string[],
  extraTags: string[] | undefined,
): string[] {
  const merged = new Set<string>();
  for (const tag of autofillTags) {
    const trimmed = tag.trim();
    if (trimmed) merged.add(trimmed);
  }
  for (const tag of extraTags ?? []) {
    const trimmed = tag.trim();
    if (trimmed) merged.add(trimmed);
  }
  return [...merged];
}

export async function findRegisteredX402ResourceUrlKeys(input: {
  userId: string;
  organizationId: string | null;
  network: PaymentNodeNetwork;
  resourceUrls: string[];
}): Promise<Set<string>> {
  const wanted = new Set<string>();
  for (const url of input.resourceUrls) {
    const key = resourceUrlDuplicateKey(url);
    if (key) wanted.add(key);
  }
  if (wanted.size === 0) return new Set();

  const agents = await prisma.agent.findMany({
    where: {
      userId: input.userId,
      organizationId: input.organizationId,
      networkIdentifier: input.network,
      registrationState: { in: [...X402_RESOURCE_URL_BLOCKED_STATES] },
    },
    select: { apiUrl: true },
  });

  const registered = new Set<string>();
  for (const agent of agents) {
    const key = resourceUrlDuplicateKey(agent.apiUrl);
    if (key && wanted.has(key)) registered.add(key);
  }
  return registered;
}

export async function findExistingX402HttpAgentByResourceUrl(input: {
  userId: string;
  organizationId: string | null;
  network: PaymentNodeNetwork;
  resourceUrl: string;
}): Promise<{ id: string } | null> {
  const targetKey = resourceUrlDuplicateKey(input.resourceUrl);
  if (!targetKey) return null;

  const agents = await prisma.agent.findMany({
    where: {
      userId: input.userId,
      organizationId: input.organizationId,
      networkIdentifier: input.network,
      registrationState: { in: [...X402_RESOURCE_URL_BLOCKED_STATES] },
    },
    select: { id: true, apiUrl: true },
  });

  for (const agent of agents) {
    if (resourceUrlDuplicateKey(agent.apiUrl) === targetKey) {
      return { id: agent.id };
    }
  }
  return null;
}

export async function startX402HttpAgentRegistration(
  input: StartX402HttpAgentRegistrationInput,
): Promise<StartX402HttpAgentRegistrationResult> {
  const trimmedResource = input.resourceUrl.trim();
  const { ctx } = input;
  const { user, activeOrganizationId, network } = ctx;

  try {
    await assertAllowedAgentApiUrl(trimmedResource);
  } catch (error) {
    return {
      ok: false,
      resourceUrl: trimmedResource,
      code: "validation",
      error:
        error instanceof Error ? error.message : "Invalid x402 resource URL",
    };
  }

  const prepared = await prepareX402HttpRegistration({
    resourceUrl: trimmedResource,
    network,
  });
  if (!prepared.ok) {
    return {
      ok: false,
      resourceUrl: trimmedResource,
      code: "validation",
      error: prepared.error,
    };
  }

  const canonicalResourceUrl = prepared.data.resourceUrl;

  if (input.skipIfDuplicate !== false) {
    const duplicate = await findExistingX402HttpAgentByResourceUrl({
      userId: user.id,
      organizationId: activeOrganizationId,
      network,
      resourceUrl: canonicalResourceUrl,
    });
    if (duplicate) {
      return {
        ok: false,
        resourceUrl: canonicalResourceUrl,
        code: "duplicate",
        error: "An agent for this resource URL is already registered.",
      };
    }
  }

  const useProbeAutofill = input.useProbeMetadataAutofill !== false;
  const autofill = buildX402ResourceAutofill(prepared.data.probeRow);
  const tags =
    (input.tags?.length ?? 0) > 0
      ? mergeTags([], input.tags)
      : useProbeAutofill
        ? mergeTags(autofill.tags, input.tags)
        : mergeTags([], ["x402"]);
  if (tags.length === 0) {
    return {
      ok: false,
      resourceUrl: prepared.data.resourceUrl,
      code: "validation",
      error: "At least one tag is required.",
    };
  }

  const resolvedName = (
    input.name?.trim() ||
    (useProbeAutofill
      ? autofill.name
      : suggestedNameFromResourceUrl(prepared.data.resourceUrl))
  ).slice(0, 250);
  const resolvedDescription = (
    input.description?.trim() ||
    (useProbeAutofill
      ? autofill.description
      : `Paid HTTP x402 resource at ${prepared.data.resourceUrl}.`)
  ).slice(0, 250);

  const agentPricing = { pricingType: "Free" as const };
  const resolvedSupportedPaymentSources = prepared.data.supportedPaymentSources;

  const paymentSourcesPreflight =
    await validateAgentRegistrationPaymentSourcesPreflight(
      network,
      resolvedSupportedPaymentSources,
      agentPricing,
    );
  if (!paymentSourcesPreflight.ok) {
    return {
      ok: false,
      resourceUrl: prepared.data.resourceUrl,
      code: "validation",
      error: paymentSourcesPreflight.error,
    };
  }

  const creditReference = createCreditReference("agent-register");
  const creditMetadata = {
    name: resolvedName,
    apiUrl: prepared.data.resourceUrl,
    network,
    authMethod: input.authMethod ?? "session",
    runtimeProvider: "DIRECT_MIP",
    registrationKind: "X402_HTTP",
  };

  try {
    await consumeCreditIfRequired({
      userId: user.id,
      reason: "agent_register",
      reference: creditReference,
      network,
      metadata: creditMetadata,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Insufficient credits.";
    return {
      ok: false,
      resourceUrl: prepared.data.resourceUrl,
      code: "credits",
      error: message,
    };
  }

  let shouldRefundRegistrationCredit = true;
  try {
    const result = await startAgentRegistration(ctx, {
      name: resolvedName,
      description: resolvedDescription,
      apiUrl: prepared.data.resourceUrl,
      runtimeProvider: "DIRECT_MIP",
      integrationConnectionId: null,
      providerConfig: null,
      tags,
      icon: input.icon?.trim() || null,
      agentPricing,
      payoutAddress: "",
      supportedPaymentSources: resolvedSupportedPaymentSources,
      exampleOutputs: [],
      capabilityName: "Masumi",
      capabilityVersion: "1.0",
      termsOfUseUrl: null,
      privacyPolicyUrl: null,
      otherUrl: null,
      registryEntryType: "X402",
      x402Manifest: prepared.data.x402Manifest,
    });

    if (!result.success) {
      await refundConsumedCredit({
        userId: user.id,
        reason: "agent_register",
        reference: creditReference,
        network,
        metadata: creditMetadata,
      });
      shouldRefundRegistrationCredit = false;
      return {
        ok: false,
        resourceUrl: prepared.data.resourceUrl,
        code: "registration",
        error: result.error,
      };
    }

    shouldRefundRegistrationCredit = false;
    return {
      ok: true,
      agentId: result.agentId,
      resourceUrl: prepared.data.resourceUrl,
    };
  } catch (error) {
    if (shouldRefundRegistrationCredit) {
      await refundConsumedCredit({
        userId: user.id,
        reason: "agent_register",
        reference: creditReference,
        network,
        metadata: creditMetadata,
      });
    }
    const message =
      error instanceof Error ? error.message : "Registration failed.";
    return {
      ok: false,
      resourceUrl: prepared.data.resourceUrl,
      code: "registration",
      error: message,
    };
  }
}
