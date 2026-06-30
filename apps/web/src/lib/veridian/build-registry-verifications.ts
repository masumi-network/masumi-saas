import type { Verification } from "@/lib/payment-node/verification-schemas";
import { VerificationMethod } from "@/lib/payment-node/verification-schemas";
import { versionIndependentAgentId } from "@/lib/registry/version-independent-agent-id";
import type { Credential } from "@/lib/veridian";

export type RegistryVerificationAnchorInput = {
  issuerAid: string;
  issuerOobi: string;
  schemaSaid: string;
  schemaOobi: string;
  credentialSaid: string;
  credentialOobi: string;
  credentialRegistry?: string;
  holderAid: string;
  holderOobi: string;
  baseUrl?: string;
  schemaVersion?: string;
};

/**
 * Build the `verifications[]` block for registry register/update from KERI trust anchors.
 */
export function buildRegistryVerificationAnchors(
  input: RegistryVerificationAnchorInput,
): Verification[] {
  return [
    {
      method: VerificationMethod.KeriAcdc,
      ...(input.schemaVersion ? { schemaVersion: input.schemaVersion } : {}),
      issuer: { aid: input.issuerAid, oobi: input.issuerOobi },
      schema: { said: input.schemaSaid, oobi: input.schemaOobi },
      credential: {
        said: input.credentialSaid,
        oobi: input.credentialOobi,
        ...(input.credentialRegistry
          ? { registry: input.credentialRegistry }
          : {}),
      },
      holder: { aid: input.holderAid, oobi: input.holderOobi },
      ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
    },
  ];
}

/**
 * Credential attribute `agentId` must bind to the version-independent registry root,
 * not the full versioned on-chain identifier.
 */
export function credentialAgentIdForRegistry(
  versionedAgentIdentifier: string,
): string {
  return versionIndependentAgentId(versionedAgentIdentifier);
}

export function buildCredentialAttributesForAgent(params: {
  versionedAgentIdentifier: string;
  agentName: string;
  agentApiUrl: string;
  kycVerificationId: string;
  signature: string;
  extraAttributes?: Record<string, unknown>;
}): Record<string, unknown> {
  const protectedFields = new Set([
    "kycVerificationId",
    "agentId",
    "agentName",
    "agentApiUrl",
    "signature",
  ]);

  const extra = params.extraAttributes
    ? Object.fromEntries(
        Object.entries(params.extraAttributes).filter(
          ([key]) => !protectedFields.has(key),
        ),
      )
    : {};

  return {
    ...extra,
    kycVerificationId: params.kycVerificationId,
    agentId: credentialAgentIdForRegistry(params.versionedAgentIdentifier),
    agentName: params.agentName,
    agentApiUrl: params.agentApiUrl,
    signature: params.signature,
  };
}

export function buildRegistryVerificationAnchorsFromCredential(params: {
  credential: Pick<Credential, "sad">;
  issuerOobi: string;
  schemaOobi: string;
  credentialOobi: string;
  holderOobi: string;
  baseUrl?: string;
  schemaVersion?: string;
}): Verification[] {
  const { sad } = params.credential;
  const holderAid = sad.a?.i;
  if (!holderAid) {
    throw new Error("Credential is missing holder AID (sad.a.i)");
  }

  return buildRegistryVerificationAnchors({
    issuerAid: sad.i,
    issuerOobi: params.issuerOobi,
    schemaSaid: sad.s,
    schemaOobi: params.schemaOobi,
    credentialSaid: sad.d,
    credentialOobi: params.credentialOobi,
    ...(sad.ri ? { credentialRegistry: sad.ri } : {}),
    holderAid,
    holderOobi: params.holderOobi,
    ...(params.baseUrl ? { baseUrl: params.baseUrl } : {}),
    ...(params.schemaVersion ? { schemaVersion: params.schemaVersion } : {}),
  });
}
