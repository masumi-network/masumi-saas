import prisma from "@masumi/database/client";

import { paymentNodeConfig } from "@/lib/payment-node/config";
import { createAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type {
  PaymentNodeNetwork,
  UpdateAgentInput,
} from "@/lib/payment-node/schemas";
import { buildUpdateAgentInput } from "@/lib/registry/build-update-agent-input";
import { hasOnChainVerification } from "@/lib/registry/on-chain-verifications";
import {
  parseStoredCredentialAttributes,
  withStoredHolderOobi,
} from "@/lib/registry/stored-credential-attributes";
import {
  extractAssetName,
  isV2RegistryAssetName,
} from "@/lib/registry/version-independent-agent-id";
import type { Credential } from "@/lib/veridian";
import {
  fetchContactCredentials,
  getAgentVerificationSchemaSaid,
  getIssuerOobi,
} from "@/lib/veridian";
import { buildRegistryVerificationAnchorsFromCredential } from "@/lib/veridian/build-registry-verifications";
import { resolveHolderOobi } from "@/lib/veridian/resolve-holder-oobi";
import { buildVerificationOobis } from "@/lib/veridian/verification-oobis";

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";
const REGISTRY_UPDATE_POLL_INTERVAL_MS = 3_000;
const REGISTRY_UPDATE_POLL_TIMEOUT_MS = 120_000;

const UPDATE_SUCCESS_STATES = new Set([
  "UpdateConfirmed",
  "RegistrationConfirmed",
]);
const UPDATE_FAILURE_STATES = new Set(["UpdateFailed"]);

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

export type WriteOnChainVerificationsResult =
  | { success: true; agentIdentifier: string; skipped?: boolean }
  | { success: false; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveSmartContractAddress(params: {
  adminClient: ReturnType<typeof createAdminPaymentNodeClient>;
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

async function pollRegistryUpdate(
  adminClient: ReturnType<typeof createAdminPaymentNodeClient>,
  registryId: string,
  network: PaymentNodeNetwork,
  previousAgentIdentifier: string,
): Promise<{ agentIdentifier: string } | { error: string }> {
  const deadline = Date.now() + REGISTRY_UPDATE_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const entry = await adminClient.getRegistryById({
      id: registryId,
      network,
    });
    if (!entry) {
      return { error: "Registry entry not found while polling update" };
    }

    if (UPDATE_FAILURE_STATES.has(entry.state)) {
      return { error: "Registry update failed on the payment node" };
    }

    if (
      UPDATE_SUCCESS_STATES.has(entry.state) &&
      entry.agentIdentifier &&
      entry.agentIdentifier !== previousAgentIdentifier
    ) {
      return { agentIdentifier: entry.agentIdentifier };
    }

    if (
      entry.state === "UpdateConfirmed" &&
      entry.agentIdentifier &&
      entry.agentIdentifier === previousAgentIdentifier
    ) {
      const onChain = await adminClient.getRegistryByAgentIdentifier({
        agentIdentifier: entry.agentIdentifier,
        network,
      });
      const verifications = onChain?.Metadata?.verifications;
      if (verifications && verifications.length > 0) {
        return { agentIdentifier: entry.agentIdentifier };
      }
    }

    await sleep(REGISTRY_UPDATE_POLL_INTERVAL_MS);
  }

  return { error: "Timed out waiting for registry update confirmation" };
}

/**
 * Attach KERI verification anchors to the agent's registry NFT via payment-node
 * update. Caller must have already validated SaaS ownership of the agent.
 */
export async function writeOnChainVerifications(params: {
  agentId: string;
  userId: string;
  holderOobi: string;
  credential: Pick<Credential, "sad">;
}): Promise<WriteOnChainVerificationsResult> {
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
      error: "On-chain verification requires a V2 registry entry",
    };
  }

  let adminClient: ReturnType<typeof createAdminPaymentNodeClient>;
  try {
    adminClient = createAdminPaymentNodeClient();
  } catch (error) {
    console.error("[Veridian] Admin payment-node client unavailable:", error);
    return {
      success: false,
      error: "Payment node admin configuration is unavailable",
    };
  }

  const network = (agent.agentReference.networkIdentifier ??
    agent.networkIdentifier ??
    DEFAULT_NETWORK) as PaymentNodeNetwork;
  const registryId = agent.agentReference.externalId;
  const refMeta = (agent.agentReference.metadata ??
    {}) as RegistrationRefMetadata;

  const onChainBefore = await adminClient.getRegistryByAgentIdentifier({
    agentIdentifier: agent.agentIdentifier,
    network,
  });

  if (hasOnChainVerification(onChainBefore)) {
    const credentialSaid = params.credential.sad?.d;
    const existing = onChainBefore?.Metadata?.verifications ?? [];
    if (
      credentialSaid &&
      existing.some((entry) => entry.credential.said === credentialSaid)
    ) {
      return {
        success: true,
        agentIdentifier: agent.agentIdentifier,
        skipped: true,
      };
    }
  }

  const registryEntry = await adminClient.getRegistryById({
    id: registryId,
    network,
  });
  if (!registryEntry) {
    return { success: false, error: "Registry entry not found" };
  }

  const onChainMetadata =
    onChainBefore ??
    (await adminClient.getRegistryByAgentIdentifier({
      agentIdentifier: agent.agentIdentifier,
      network,
    }));

  if (!onChainMetadata) {
    return {
      success: false,
      error: "On-chain registry metadata could not be loaded",
    };
  }

  const issuerOobi = await getIssuerOobi();
  const schemaSaid = getAgentVerificationSchemaSaid();
  const credentialSaid = params.credential.sad?.d;
  if (!credentialSaid) {
    return { success: false, error: "Credential SAID is missing" };
  }

  const oobis = buildVerificationOobis({
    issuerOobi,
    schemaSaid,
    credentialSaid,
    holderOobi: params.holderOobi,
  });

  const verifications = buildRegistryVerificationAnchorsFromCredential({
    credential: params.credential,
    issuerOobi: oobis.issuerOobi,
    schemaOobi: oobis.schemaOobi,
    credentialOobi: oobis.credentialOobi,
    holderOobi: oobis.holderOobi,
    schemaVersion: "1",
  });

  const smartContractAddress = await resolveSmartContractAddress({
    adminClient,
    userId: params.userId,
    network,
    refMeta,
  });

  const updateBody = buildUpdateAgentInput({
    network,
    agentIdentifier: agent.agentIdentifier,
    smartContractAddress,
    registryEntry,
    onChainMetadata,
    storedRegistration: refMeta.registrationPayload ?? null,
    verifications,
  });

  const previousAgentIdentifier = agent.agentIdentifier;

  try {
    await adminClient.updateAgent(updateBody);
  } catch (error) {
    console.error("[Veridian] Registry update request failed:", {
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
  );

  if ("error" in pollResult) {
    console.error("[Veridian] Registry update poll failed:", {
      agentId: params.agentId,
      userId: params.userId,
      error: pollResult.error,
    });
    return { success: false, error: pollResult.error };
  }

  await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: { agentIdentifier: pollResult.agentIdentifier },
    }),
    prisma.agentReference.update({
      where: { agentId: agent.id },
      data: {
        metadata: {
          ...refMeta,
          agentIdentifier: pollResult.agentIdentifier,
        },
      },
    }),
  ]);

  return { success: true, agentIdentifier: pollResult.agentIdentifier };
}

function patchStoredAttributesWithHolderOobi(
  raw: string | null,
  holderOobi: string,
): string {
  const { attributes } = parseStoredCredentialAttributes(raw);
  return JSON.stringify(withStoredHolderOobi(attributes, holderOobi));
}

/**
 * Resolve holder OOBI (stored or credential-server contact) and write anchors.
 * Returns null when holder OOBI cannot be resolved.
 */
export async function writeOnChainVerificationsFromStoredCredential(params: {
  agentId: string;
  userId: string;
  credential: Pick<Credential, "sad">;
  storedAttributesRaw?: string | null;
  veridianCredentialId?: string;
}): Promise<WriteOnChainVerificationsResult | null> {
  const { holderOobi: storedHolderOobi } = parseStoredCredentialAttributes(
    params.storedAttributesRaw,
  );
  const holderAid = params.credential.sad?.a?.i;
  const holderOobi = await resolveHolderOobi({
    storedHolderOobi,
    holderAid,
  });

  if (!holderOobi) {
    console.error(
      "[Veridian] Skipping on-chain verification write: holder OOBI not stored and not found on credential server",
      {
        agentId: params.agentId,
        holderAid,
        veridianCredentialId: params.veridianCredentialId,
      },
    );
    return null;
  }

  if (!storedHolderOobi && params.veridianCredentialId) {
    const existing = await prisma.veridianCredential.findUnique({
      where: { id: params.veridianCredentialId },
      select: { attributes: true, credentialData: true },
    });
    if (existing) {
      await prisma.veridianCredential.update({
        where: { id: params.veridianCredentialId },
        data: {
          attributes: patchStoredAttributesWithHolderOobi(
            existing.attributes,
            holderOobi,
          ),
          credentialData: patchStoredAttributesWithHolderOobi(
            existing.credentialData,
            holderOobi,
          ),
        },
      });
    }
  }

  return writeOnChainVerifications({
    agentId: params.agentId,
    userId: params.userId,
    holderOobi,
    credential: params.credential,
  });
}

/**
 * For agents already VERIFIED in SaaS but missing registry verification anchors.
 */
export async function backfillOnChainVerificationsForAgent(params: {
  agentId: string;
  userId: string;
}): Promise<boolean> {
  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, userId: params.userId },
    include: { agentReference: true },
  });

  if (
    !agent ||
    agent.verificationStatus !== "VERIFIED" ||
    !agent.veridianCredentialId ||
    !agent.agentIdentifier
  ) {
    return false;
  }

  let adminClient: ReturnType<typeof createAdminPaymentNodeClient>;
  try {
    adminClient = createAdminPaymentNodeClient();
  } catch (error) {
    console.error(
      "[Veridian] On-chain backfill skipped: admin client unavailable",
      { agentId: params.agentId, error },
    );
    return false;
  }

  const network = (agent.agentReference?.networkIdentifier ??
    agent.networkIdentifier ??
    DEFAULT_NETWORK) as PaymentNodeNetwork;

  const onChainBefore = await adminClient.getRegistryByAgentIdentifier({
    agentIdentifier: agent.agentIdentifier,
    network,
  });

  const credentialSaid = agent.veridianCredentialId;
  if (hasOnChainVerification(onChainBefore)) {
    const existing = onChainBefore?.Metadata?.verifications ?? [];
    if (existing.some((entry) => entry.credential.said === credentialSaid)) {
      return false;
    }
  }

  const veridianCredential = await prisma.veridianCredential.findFirst({
    where: {
      agentId: params.agentId,
      userId: params.userId,
      status: "ISSUED",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!veridianCredential) {
    return false;
  }

  const credentials = await fetchContactCredentials(veridianCredential.aid);
  const issuedCredential = credentials.find(
    (cred) => cred.sad?.d === credentialSaid,
  );

  if (!issuedCredential) {
    console.error("[Veridian] On-chain backfill: issued credential not found", {
      agentId: params.agentId,
      credentialSaid,
      holderAid: veridianCredential.aid,
    });
    return false;
  }

  const result = await writeOnChainVerificationsFromStoredCredential({
    agentId: params.agentId,
    userId: params.userId,
    credential: issuedCredential,
    storedAttributesRaw:
      veridianCredential.attributes ?? veridianCredential.credentialData,
    veridianCredentialId: veridianCredential.id,
  });

  return result?.success === true;
}
