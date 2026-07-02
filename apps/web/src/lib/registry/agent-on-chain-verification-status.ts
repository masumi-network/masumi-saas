import { shouldReadOnChainAgentVerification } from "@/lib/config/verification.config";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import type {
  PaymentNodeNetwork,
  RegistryAgentIdentifierMetadata,
  RegistryRequestState,
} from "@/lib/payment-node/schemas";
import { findAgentByRegistryIdentifier } from "@/lib/registry/find-agent-by-registry-identifier";
import {
  findOnChainKeriVerification,
  getOnChainVerifications,
} from "@/lib/registry/on-chain-verifications";
import { resolveAgentVerification } from "@/lib/registry/resolve-agent-verification";
import { getAgentVerificationSchemaSaid } from "@/lib/veridian";

export type AgentOnChainVerificationStatus = {
  /** Whether on-chain reads are configured (admin client + schema SAID). */
  configured: boolean;
  /** Agent has a registry `agentIdentifier` on file. */
  registered: boolean;
  /** Registry NFT metadata includes at least one KERI-ACDC anchor. */
  hasAnchors: boolean;
  /** Resolved verification outcome (chain preferred, DB fallback when enabled). */
  verified: boolean;
  credentialId: string | null;
  expiresAt: string | null;
  schemaSaid: string | null;
  holderAid: string | null;
  credentialSaid: string | null;
  issuerAid: string | null;
  resolutionSource: "on-chain" | "database" | null;
  registryAgentIdentifier: string | null;
  queriedAgentIdentifier: string | null;
  /** Payment-service registry row state (e.g always null when not loaded). */
  registryState: RegistryRequestState | null;
};

function paymentNetwork(
  networkIdentifier: string | null | undefined,
): PaymentNodeNetwork {
  return networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod";
}

function anchorFieldsFromMetadata(
  onChain: RegistryAgentIdentifierMetadata | null,
): Pick<
  AgentOnChainVerificationStatus,
  | "hasAnchors"
  | "schemaSaid"
  | "holderAid"
  | "credentialSaid"
  | "issuerAid"
  | "registryAgentIdentifier"
> {
  if (!onChain) {
    return {
      hasAnchors: false,
      schemaSaid: null,
      holderAid: null,
      credentialSaid: null,
      issuerAid: null,
      registryAgentIdentifier: null,
    };
  }

  let schemaSaid: string | null = null;
  let holderAid: string | null = null;
  let credentialSaid: string | null = null;
  let issuerAid: string | null = null;

  try {
    const expectedSchemaSaid = getAgentVerificationSchemaSaid();
    const verifications = getOnChainVerifications(onChain);
    const anchor = findOnChainKeriVerification(
      verifications,
      expectedSchemaSaid,
    );
    if (anchor) {
      schemaSaid = anchor.schema.said;
      holderAid = anchor.holder.aid;
      credentialSaid = anchor.credential.said;
      issuerAid = anchor.issuer.aid;
    }

    return {
      hasAnchors: Boolean(verifications?.length),
      schemaSaid,
      holderAid,
      credentialSaid,
      issuerAid,
      registryAgentIdentifier: onChain.agentIdentifier,
    };
  } catch {
    const verifications = getOnChainVerifications(onChain);
    return {
      hasAnchors: Boolean(verifications?.length),
      schemaSaid: null,
      holderAid: null,
      credentialSaid: null,
      issuerAid: null,
      registryAgentIdentifier: onChain.agentIdentifier,
    };
  }
}

/**
 * Owner-facing on-chain verification status for the agent verification UI.
 */
async function fetchRegistryState(params: {
  registryExternalId?: string | null;
  network: PaymentNodeNetwork;
  smartContractAddress?: string | null;
}): Promise<RegistryRequestState | null> {
  const externalId = params.registryExternalId?.trim();
  if (!externalId) return null;

  const adminClient = tryCreateAdminPaymentNodeClient();
  if (!adminClient) return null;

  try {
    const entry = await adminClient.getRegistryById({
      id: externalId,
      network: params.network,
      filterSmartContractAddress: params.smartContractAddress,
    });
    return entry?.state ?? null;
  } catch (error) {
    console.error("[Veridian] Failed to load registry state:", {
      registryExternalId: externalId,
      network: params.network,
      error,
    });
    return null;
  }
}

export async function getAgentOnChainVerificationStatus(params: {
  agentIdentifier: string | null;
  networkIdentifier: string | null;
  registryExternalId?: string | null;
  smartContractAddress?: string | null;
}): Promise<AgentOnChainVerificationStatus> {
  const empty: AgentOnChainVerificationStatus = {
    configured: false,
    registered: false,
    hasAnchors: false,
    verified: false,
    credentialId: null,
    expiresAt: null,
    schemaSaid: null,
    holderAid: null,
    credentialSaid: null,
    issuerAid: null,
    resolutionSource: null,
    registryAgentIdentifier: null,
    queriedAgentIdentifier: null,
    registryState: null,
  };

  if (!params.agentIdentifier?.trim()) {
    return empty;
  }

  const lookup = await findAgentByRegistryIdentifier(params.agentIdentifier);
  const chainAgentIdentifier =
    lookup?.canonicalAgentIdentifier ?? params.agentIdentifier;
  const network = paymentNetwork(
    lookup?.agent.networkIdentifier ?? params.networkIdentifier,
  );

  const registryStatePromise = fetchRegistryState({
    registryExternalId: params.registryExternalId,
    network,
    smartContractAddress: params.smartContractAddress,
  });

  const adminClient = tryCreateAdminPaymentNodeClient();
  const configured =
    shouldReadOnChainAgentVerification() && adminClient !== null;

  let prefetchedMetadata: RegistryAgentIdentifierMetadata | null | undefined;
  let anchorFields = {
    hasAnchors: false,
    schemaSaid: null as string | null,
    holderAid: null as string | null,
    credentialSaid: null as string | null,
    issuerAid: null as string | null,
    registryAgentIdentifier: null as string | null,
  };

  if (configured && adminClient) {
    try {
      const onChain = await adminClient.getRegistryByAgentIdentifier({
        agentIdentifier: chainAgentIdentifier,
        network,
      });
      prefetchedMetadata = onChain;
      anchorFields = anchorFieldsFromMetadata(onChain);
    } catch (error) {
      console.error("[Veridian] Failed to load on-chain verification status:", {
        agentIdentifier: chainAgentIdentifier,
        network,
        error,
      });
      prefetchedMetadata = undefined;
    }
  }

  const resolved = await resolveAgentVerification({
    agentIdentifier: params.agentIdentifier,
    network,
    prefetchedRegistryMetadata: prefetchedMetadata,
    prefetchedNetwork: network,
  });

  const verified = resolved.verified === true;
  const resolutionSource = "source" in resolved ? resolved.source : null;
  const credentialId =
    "credentialId" in resolved ? resolved.credentialId : null;
  const expiresAt = "expiresAt" in resolved ? resolved.expiresAt : null;

  let { hasAnchors, schemaSaid, holderAid, credentialSaid, issuerAid } =
    anchorFields;
  const registryAgentIdentifier =
    anchorFields.registryAgentIdentifier ?? chainAgentIdentifier;

  if (resolutionSource === "on-chain") {
    hasAnchors = true;
    credentialSaid ??= credentialId;
  }

  const registryState = await registryStatePromise;

  return {
    configured,
    registered: true,
    hasAnchors,
    verified,
    credentialId,
    expiresAt,
    schemaSaid,
    holderAid,
    credentialSaid,
    issuerAid,
    resolutionSource,
    registryAgentIdentifier,
    queriedAgentIdentifier: chainAgentIdentifier,
    registryState,
  };
}
