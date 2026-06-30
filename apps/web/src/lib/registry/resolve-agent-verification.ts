import prisma from "@masumi/database/client";

import {
  shouldReadOnChainAgentVerification,
  shouldUseDbVerificationFallback,
} from "@/lib/config/verification.config";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import type { PaymentNodeNetwork } from "@/lib/payment-node/schemas";
import { findAgentByRegistryIdentifier } from "@/lib/registry/find-agent-by-registry-identifier";
import {
  findOnChainKeriVerification,
  getOnChainVerifications,
} from "@/lib/registry/on-chain-verifications";
import { credentialMatchesAgentRegistryId } from "@/lib/registry/stored-credential-attributes";
import {
  extractCredentialAttributes,
  fetchContactCredentials,
  findCredentialBySchema,
  getAgentVerificationSchemaSaid,
  validateCredential,
} from "@/lib/veridian";

export type ResolvedAgentVerification =
  | { verified: false }
  | {
      verified: boolean;
      credentialId: string;
      expiresAt: string | null;
      agentName: string;
      apiUrl: string;
      source: "on-chain" | "database";
    };

const PAYMENT_NETWORKS: PaymentNodeNetwork[] = ["Preprod", "Mainnet"];

function credentialExpiresAt(
  validation: ReturnType<typeof validateCredential>,
): string | null {
  const expiresAt = validation.details?.expiresAt;
  return typeof expiresAt === "string" ? expiresAt : null;
}

function isCredentialExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function paymentNetworksForAgent(
  networkIdentifier: string | null | undefined,
): PaymentNodeNetwork[] {
  if (networkIdentifier === "Mainnet") {
    return ["Mainnet"];
  }
  if (networkIdentifier === "Preprod") {
    return ["Preprod"];
  }
  return PAYMENT_NETWORKS;
}

async function resolveOnChainAgentVerification(params: {
  agentIdentifier: string;
  network?: PaymentNodeNetwork;
  networkIdentifier?: string | null;
}): Promise<ResolvedAgentVerification | null> {
  const adminClient = tryCreateAdminPaymentNodeClient();
  if (!adminClient) {
    return null;
  }

  let schemaSaid: string;
  try {
    schemaSaid = getAgentVerificationSchemaSaid();
  } catch (error) {
    console.error(
      "[Veridian] On-chain verification read skipped: schema SAID unavailable",
      error,
    );
    return null;
  }

  const networks = params.network
    ? [params.network]
    : paymentNetworksForAgent(params.networkIdentifier);

  for (const network of networks) {
    let onChainMetadata;
    try {
      onChainMetadata = await adminClient.getRegistryByAgentIdentifier({
        agentIdentifier: params.agentIdentifier,
        network,
      });
    } catch (error) {
      console.error("[Veridian] Failed to load on-chain registry metadata:", {
        agentIdentifier: params.agentIdentifier,
        network,
        error,
      });
      continue;
    }

    const verifications = getOnChainVerifications(onChainMetadata);
    const anchor = findOnChainKeriVerification(verifications, schemaSaid);
    if (!anchor) {
      continue;
    }

    const chainAgentIdentifier =
      onChainMetadata?.agentIdentifier ?? params.agentIdentifier;

    let credentials;
    try {
      credentials = await fetchContactCredentials(anchor.holder.aid);
    } catch (error) {
      console.error("[Veridian] Failed to fetch holder credentials:", {
        holderAid: anchor.holder.aid,
        error,
      });
      return null;
    }

    const credential = findCredentialBySchema(credentials, schemaSaid);
    if (!credential?.sad?.d || credential.sad.d !== anchor.credential.said) {
      return null;
    }

    const validation = validateCredential(credential);
    if (!validation.isValid) {
      const attrs = extractCredentialAttributes(credential);
      const agentName =
        typeof attrs.agentName === "string"
          ? attrs.agentName
          : (onChainMetadata?.Metadata.name ?? "");
      const apiUrl =
        typeof attrs.agentApiUrl === "string"
          ? attrs.agentApiUrl
          : (onChainMetadata?.Metadata.apiBaseUrl ?? "");

      if (agentName && apiUrl && credential.sad.d) {
        return {
          verified: false,
          credentialId: credential.sad.d,
          expiresAt: credentialExpiresAt(validation),
          agentName,
          apiUrl,
          source: "on-chain",
        };
      }

      return null;
    }

    const attrs = extractCredentialAttributes(credential);
    const credentialAgentId =
      typeof attrs.agentId === "string" ? attrs.agentId : undefined;

    if (
      !credentialMatchesAgentRegistryId(credentialAgentId, chainAgentIdentifier)
    ) {
      console.error("[Veridian] Credential agentId does not match registry:", {
        credentialAgentId,
        chainAgentIdentifier,
      });
      return { verified: false };
    }

    const expiresAt = credentialExpiresAt(validation);
    const agentName =
      typeof attrs.agentName === "string"
        ? attrs.agentName
        : onChainMetadata?.Metadata.name;
    const apiUrl =
      typeof attrs.agentApiUrl === "string"
        ? attrs.agentApiUrl
        : onChainMetadata?.Metadata.apiBaseUrl;

    if (!agentName || !apiUrl || !credential.sad.d) {
      return null;
    }

    return {
      verified: !isCredentialExpired(expiresAt),
      credentialId: credential.sad.d,
      expiresAt,
      agentName,
      apiUrl,
      source: "on-chain",
    };
  }

  return null;
}

async function resolveDbAgentVerification(
  agentIdentifier: string,
): Promise<ResolvedAgentVerification | null> {
  const lookup = await findAgentByRegistryIdentifier(agentIdentifier);
  const agent = lookup?.agent;

  if (!agent || agent.verificationStatus !== "VERIFIED") {
    return null;
  }

  const credential = await prisma.veridianCredential.findFirst({
    where: { agentId: agent.id, status: "ISSUED" },
    select: { credentialId: true, expiresAt: true },
    orderBy: { issuedAt: "desc" },
  });

  if (!credential) {
    return null;
  }

  const expiresAt = credential.expiresAt
    ? credential.expiresAt.toISOString()
    : null;

  return {
    verified: !isCredentialExpired(expiresAt),
    credentialId: credential.credentialId,
    expiresAt,
    agentName: agent.name,
    apiUrl: agent.apiUrl,
    source: "database",
  };
}

/**
 * Resolve whether an agent is verified, preferring on-chain registry anchors
 * when enabled and falling back to SaaS DB state during backfill.
 */
export async function resolveAgentVerification(params: {
  agentIdentifier: string;
  network?: PaymentNodeNetwork;
}): Promise<ResolvedAgentVerification> {
  const lookup = await findAgentByRegistryIdentifier(params.agentIdentifier);
  const chainAgentIdentifier =
    lookup?.canonicalAgentIdentifier ?? params.agentIdentifier;

  if (shouldReadOnChainAgentVerification()) {
    const onChain = await resolveOnChainAgentVerification({
      agentIdentifier: chainAgentIdentifier,
      network: params.network,
      networkIdentifier: lookup?.agent.networkIdentifier,
    });
    if (onChain !== null) {
      return onChain;
    }
  }

  if (shouldUseDbVerificationFallback()) {
    const fromDb = await resolveDbAgentVerification(params.agentIdentifier);
    if (fromDb) {
      return fromDb;
    }
  }

  return { verified: false };
}
