import prisma from "@masumi/database/client";

import {
  isUpdateRequestedStale,
  STALE_UPDATE_REQUESTED_MS,
} from "@/lib/agents/registration-state";
import { sendOnChainVerificationCompleteEmail } from "@/lib/email/send-on-chain-verification-complete";
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
  smartContractAddress: string | undefined,
): Promise<{ agentIdentifier: string } | { error: string }> {
  const deadline = Date.now() + REGISTRY_UPDATE_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let entry;
    try {
      entry = await adminClient.getRegistryById({
        id: registryId,
        network,
        filterSmartContractAddress: smartContractAddress,
      });
    } catch (error) {
      console.error("[Veridian] Registry poll fetch failed (will retry):", {
        registryId,
        network,
        error,
      });
      await sleep(REGISTRY_UPDATE_POLL_INTERVAL_MS);
      continue;
    }

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
      try {
        const onChain = await adminClient.getRegistryByAgentIdentifier({
          agentIdentifier: entry.agentIdentifier,
          network,
        });
        const verifications = onChain?.Metadata?.verifications;
        if (verifications && verifications.length > 0) {
          return { agentIdentifier: entry.agentIdentifier };
        }
      } catch (error) {
        console.error(
          "[Veridian] Registry poll on-chain metadata fetch failed (will retry):",
          { agentIdentifier: entry.agentIdentifier, network, error },
        );
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

  // Scope registry-row lookups to this agent's payment source. On shared
  // payment nodes the unfiltered list does not surface a given source's rows
  // within the page budget, so getRegistryById would otherwise return null.
  const smartContractAddress = await resolveSmartContractAddress({
    adminClient,
    userId: params.userId,
    network,
    refMeta,
  });

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

  // Skip when an update is genuinely in flight, but fall through when the lock
  // is stale (a prior attempt was killed after flipping the row to
  // UpdateRequested but before/around the on-chain submit) so recovery can retry.
  if (
    agent.registrationState === "UpdateRequested" &&
    !isUpdateRequestedStale({
      registrationState: agent.registrationState,
      updatedAt: agent.updatedAt,
    })
  ) {
    return {
      success: true,
      agentIdentifier: agent.agentIdentifier,
      skipped: true,
    };
  }

  const registryEntry = await adminClient.getRegistryById({
    id: registryId,
    network,
    filterSmartContractAddress: smartContractAddress,
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

  // Claim the update lock atomically from a settled state, OR re-claim a stale
  // UpdateRequested left behind by a killed attempt. Concurrent callers race on
  // this single updateMany: the winner bumps `updatedAt` (resetting staleness),
  // so any loser's `updatedAt < threshold` predicate no longer matches and it
  // falls through to the skip below — no double submit.
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
    const onChainRetry = await adminClient.getRegistryByAgentIdentifier({
      agentIdentifier: agent.agentIdentifier,
      network,
    });
    if (hasOnChainVerification(onChainRetry)) {
      const credentialSaid = params.credential.sad?.d;
      const existing = onChainRetry?.Metadata?.verifications ?? [];
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
    return {
      success: true,
      agentIdentifier: agent.agentIdentifier,
      skipped: true,
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
    smartContractAddress,
  );

  if ("error" in pollResult) {
    console.error("[Veridian] Registry update poll failed:", {
      agentId: params.agentId,
      userId: params.userId,
      error: pollResult.error,
    });

    // Polling timed out, but the update may still have landed on-chain (confirmation
    // can exceed the poll window). Reconcile against on-chain state so the agent is
    // never left pinned in UpdateRequested with no recovery path (which would show
    // "update in progress" forever and never send the completion email).
    const credentialSaid = params.credential.sad?.d;
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

      // The identifier bumps on a successful V2 update; fall back to the previous one.
      const candidateIdentifier =
        failedEntry?.agentIdentifier &&
        failedEntry.agentIdentifier !== previousAgentIdentifier
          ? failedEntry.agentIdentifier
          : previousAgentIdentifier;
      const onChain = await adminClient.getRegistryByAgentIdentifier({
        agentIdentifier: candidateIdentifier,
        network,
      });
      const anchored =
        credentialSaid != null &&
        (onChain?.Metadata?.verifications ?? []).some(
          (entry) => entry.credential.said === credentialSaid,
        );
      if (anchored) {
        // The anchor is on-chain — treat the update as the success it actually was.
        await prisma.$transaction([
          prisma.agent.update({
            where: { id: agent.id },
            data: {
              agentIdentifier: candidateIdentifier,
              registrationState: "RegistrationConfirmed",
            },
          }),
          prisma.agentReference.update({
            where: { agentId: agent.id },
            data: {
              metadata: {
                ...refMeta,
                agentIdentifier: candidateIdentifier,
              },
            },
          }),
        ]);
        return { success: true, agentIdentifier: candidateIdentifier };
      }
    } catch (error) {
      console.error(
        "[Veridian] Failed to reconcile registry row after poll error:",
        {
          agentId: params.agentId,
          userId: params.userId,
          error,
        },
      );
    }

    // Not confirmed on-chain: release the UpdateRequested lock back to
    // RegistrationConfirmed so a later reconcile/backfill can retry the write.
    try {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { registrationState: "RegistrationConfirmed" },
      });
    } catch (error) {
      console.error(
        "[Veridian] Failed to reset registrationState after poll error:",
        {
          agentId: params.agentId,
          userId: params.userId,
          error,
        },
      );
    }
    return { success: false, error: pollResult.error };
  }

  await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: {
        agentIdentifier: pollResult.agentIdentifier,
        registrationState: "RegistrationConfirmed",
      },
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

  // A fresh UpdateRequested is genuinely in flight; a stale one is an abandoned
  // lock — let it fall through so the delegated write path can re-claim + retry.
  if (
    agent.registrationState === "UpdateRequested" &&
    !isUpdateRequestedStale({
      registrationState: agent.registrationState,
      updatedAt: agent.updatedAt,
    })
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

/** Write registry verification anchors after a wallet credential is accepted. */
export async function triggerOnChainVerificationWrite(params: {
  agentId: string;
  userId: string;
  issuedCredential: Pick<Credential, "sad">;
  veridianCredentialId: string;
  storedAttributesRaw?: string | null;
}): Promise<boolean> {
  try {
    const onChainResult = await writeOnChainVerificationsFromStoredCredential({
      agentId: params.agentId,
      userId: params.userId,
      credential: params.issuedCredential,
      storedAttributesRaw: params.storedAttributesRaw,
      veridianCredentialId: params.veridianCredentialId,
    });

    if (onChainResult === null) {
      console.error(
        "[Veridian] On-chain verification write skipped (holder OOBI unresolved):",
        {
          agentId: params.agentId,
          veridianCredentialId: params.veridianCredentialId,
        },
      );
      return false;
    }

    if (!onChainResult.success) {
      console.error("[Veridian] On-chain verification write failed:", {
        agentId: params.agentId,
        userId: params.userId,
        error: onChainResult.error,
      });
      return false;
    }

    if (!onChainResult.skipped) {
      const agent = await prisma.agent.findUnique({
        where: { id: params.agentId },
        select: { name: true },
      });
      if (agent) {
        await sendOnChainVerificationCompleteEmail(
          params.userId,
          params.agentId,
          agent.name,
        );
      }
    }

    return true;
  } catch (error) {
    console.error("[Veridian] On-chain verification write threw:", {
      agentId: params.agentId,
      userId: params.userId,
      veridianCredentialId: params.veridianCredentialId,
      error,
    });
    return false;
  }
}
