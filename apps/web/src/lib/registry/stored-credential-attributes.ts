import { versionIndependentAgentId } from "@/lib/registry/version-independent-agent-id";

/** Internal metadata stored alongside issued credential attributes in DB. */
export const MASUMI_HOLDER_OOBI_ATTR = "__masumiHolderOobi" as const;

export function withStoredHolderOobi(
  attributes: Record<string, unknown>,
  holderOobi: string | undefined,
): Record<string, unknown> {
  if (!holderOobi?.trim()) return attributes;
  return { ...attributes, [MASUMI_HOLDER_OOBI_ATTR]: holderOobi.trim() };
}

export function parseStoredCredentialAttributes(
  raw: string | null | undefined,
): {
  attributes: Record<string, unknown>;
  holderOobi: string | null;
} {
  if (!raw) {
    return { attributes: {}, holderOobi: null };
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const holderOobi =
      typeof parsed[MASUMI_HOLDER_OOBI_ATTR] === "string"
        ? parsed[MASUMI_HOLDER_OOBI_ATTR]
        : null;
    const { [MASUMI_HOLDER_OOBI_ATTR]: _removed, ...attributes } = parsed;
    return { attributes, holderOobi };
  } catch {
    return { attributes: {}, holderOobi: null };
  }
}

export function credentialMatchesAgentRegistryId(
  credentialAgentId: string | undefined,
  versionedAgentIdentifier: string,
): boolean {
  if (!credentialAgentId) return false;
  if (credentialAgentId === versionedAgentIdentifier) return true;

  try {
    return (
      credentialAgentId === versionIndependentAgentId(versionedAgentIdentifier)
    );
  } catch {
    return false;
  }
}
