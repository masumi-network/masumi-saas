import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { triggerOnChainVerificationWrite } from "@/lib/registry/write-on-chain-verifications";
import {
  fetchContactCredentials,
  getAgentVerificationSchemaSaid,
} from "@/lib/veridian";

import { hasHolderAdmittedIpexGrant } from "./holder-ipex-admit";
import { resolvePendingWalletCredential } from "./resolve-pending-wallet-credential";

export type FinalizePendingVeridianCredentialResult =
  | {
      outcome: "pending";
      id: string;
      status: "PENDING";
    }
  | {
      outcome: "issued";
      id: string;
      credentialId: string;
      status: string;
      newlyIssued: boolean;
    };

/**
 * Idempotently resolve a pending Veridian credential row when the issuer has
 * issued a matching credential and the holder has admitted the IPEX grant in
 * their wallet. Only the caller that wins the PENDING → ISSUED transition
 * runs agent updates and on-chain writes.
 */
export async function finalizePendingVeridianCredential(params: {
  pendingCredentialId: string;
  userId: string;
}): Promise<FinalizePendingVeridianCredentialResult> {
  const pendingCredential = await prisma.veridianCredential.findFirst({
    where: { id: params.pendingCredentialId, userId: params.userId },
  });

  if (!pendingCredential) {
    throw new Error("Credential not found");
  }

  if (pendingCredential.status !== "PENDING") {
    return {
      outcome: "issued",
      id: pendingCredential.id,
      credentialId: pendingCredential.credentialId,
      status: pendingCredential.status,
      newlyIssued: false,
    };
  }

  const { aid, agentId } = pendingCredential;
  const schemaSaid = getAgentVerificationSchemaSaid();

  const agent = agentId
    ? await prisma.agent.findFirst({
        where: { id: agentId },
        select: { agentIdentifier: true, verificationStatus: true },
      })
    : null;

  const credentials = await fetchContactCredentials(aid);
  const issuedCredential = resolvePendingWalletCredential({
    pending: pendingCredential,
    credentials,
    schemaSaid,
    versionedAgentIdentifier: agent?.agentIdentifier ?? null,
  });

  if (!issuedCredential?.sad?.d) {
    return {
      outcome: "pending",
      id: pendingCredential.id,
      status: "PENDING",
    };
  }

  const credentialId = issuedCredential.sad.d;

  const walletAdmitted = await hasHolderAdmittedIpexGrant({
    holderAid: aid,
    pending: pendingCredential,
    schemaSaid,
    versionedAgentIdentifier: agent?.agentIdentifier ?? null,
    credentialSaid: credentialId,
  });

  if (!walletAdmitted) {
    return {
      outcome: "pending",
      id: pendingCredential.id,
      status: "PENDING",
    };
  }

  const claim = await prisma.veridianCredential.updateMany({
    where: {
      id: pendingCredential.id,
      userId: params.userId,
      status: "PENDING",
    },
    data: {
      credentialId,
      status: "ISSUED",
    },
  });

  if (claim.count === 0) {
    const current = await prisma.veridianCredential.findFirst({
      where: { id: pendingCredential.id, userId: params.userId },
    });
    if (!current) {
      throw new Error("Credential not found");
    }
    return {
      outcome: "issued",
      id: current.id,
      credentialId: current.credentialId,
      status: current.status,
      newlyIssued: false,
    };
  }

  if (agentId) {
    const priorVerified = agent?.verificationStatus === "VERIFIED";
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        verificationStatus: "VERIFIED",
        veridianCredentialId: credentialId,
      },
    });
    if (!priorVerified) {
      await recordAgentActivityEvent(agentId, "AgentVerified");
    }

    await triggerOnChainVerificationWrite({
      agentId,
      userId: params.userId,
      issuedCredential,
      veridianCredentialId: pendingCredential.id,
      storedAttributesRaw:
        pendingCredential.attributes ?? pendingCredential.credentialData,
    });
  }

  return {
    outcome: "issued",
    id: pendingCredential.id,
    credentialId,
    status: "ISSUED",
    newlyIssued: true,
  };
}
