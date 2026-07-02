import {
  credentialMatchesAgentRegistryId,
  parseStoredCredentialAttributes,
} from "@/lib/registry/stored-credential-attributes";
import type { Credential } from "@/lib/veridian";
import { validateCredential } from "@/lib/veridian";

/** Allow small clock skew between SaaS and credential-server-side `dt`. */
const PENDING_ISSUED_AT_SKEW_MS = 60_000;

export type PendingCredentialRow = {
  createdAt: Date;
  attributes?: string | null;
  credentialData?: string | null;
};

/**
 * Resolve a wallet credential that corresponds to a specific pending issuance.
 *
 * Ignores older credentials for the same agent/schema so polling does not
 * complete until the holder accepts the credential from this request.
 */
export function resolvePendingWalletCredential(params: {
  pending: PendingCredentialRow;
  credentials: Credential[];
  schemaSaid: string;
  versionedAgentIdentifier: string | null;
}): Credential | null {
  const { attributes: expectedAttrs } = parseStoredCredentialAttributes(
    params.pending.attributes ?? params.pending.credentialData,
  );
  const expectedSignature =
    typeof expectedAttrs.signature === "string"
      ? expectedAttrs.signature
      : null;
  const pendingSinceMs = params.pending.createdAt.getTime();

  const candidates = params.credentials.filter((cred) => {
    const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
    if (credSchemaSaid !== params.schemaSaid) return false;
    if (!cred.sad?.d) return false;

    if (params.versionedAgentIdentifier) {
      const credAgentId = cred.sad.a?.agentId as string | undefined;
      if (
        !credentialMatchesAgentRegistryId(
          credAgentId,
          params.versionedAgentIdentifier,
        )
      ) {
        return false;
      }
    }

    const issuedAtMs = new Date((cred.sad.a?.dt as string) || 0).getTime();
    if (
      issuedAtMs > 0 &&
      issuedAtMs < pendingSinceMs - PENDING_ISSUED_AT_SKEW_MS
    ) {
      return false;
    }

    if (expectedSignature) {
      const credSignature = cred.sad.a?.signature as string | undefined;
      if (credSignature !== expectedSignature) return false;
    }

    return validateCredential(cred).isValid;
  });

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const dateA = new Date((a.sad?.a?.dt as string) || 0).getTime();
    const dateB = new Date((b.sad?.a?.dt as string) || 0).getTime();
    return dateB - dateA;
  })[0]!;
}
