import prisma from "@masumi/database/client";

import {
  shouldReadOnChainAgentVerification,
  shouldUseDbVerificationFallback,
} from "@/lib/config/verification.config";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import type { PaymentNodeNetwork } from "@/lib/payment-node/schemas";
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

async function resolvePaymentNetworks(
  agentIdentifier: string,
): Promise<PaymentNodeNetwork[]> {
  const agent = await prisma.agent.findFirst({
    where: { agentIdentifier },
    select: { networkIdentifier: true },
  });

  if (agent?.networkIdentifier === "Mainnet") {
    return ["Mainnet"];
  }
  if (agent?.networkIdentifier === "Preprod") {
    return ["Preprod"];
  }

  return PAYMENT_NETWORKS;
}

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

async function resolveOnChainAgentVerification(params: {
  agentIdentifier: string;
  network?: PaymentNodeNetwork;
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
    : await resolvePaymentNetworks(params.agentIdentifier);

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
      return { verified: false };
    }

    const credential = findCredentialBySchema(credentials, schemaSaid);
    if (!credential?.sad?.d || credential.sad.d !== anchor.credential.said) {
      return { verified: false };
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

      return { verified: false };
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
      return { verified: false };
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
  const agent = await prisma.agent.findFirst({
    where: { agentIdentifier },
    select: {
      id: true,
      name: true,
      apiUrl: true,
      verificationStatus: true,
    },
  });

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
  if (shouldReadOnChainAgentVerification()) {
    const onChain = await resolveOnChainAgentVerification(params);
    if (onChain) {
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
