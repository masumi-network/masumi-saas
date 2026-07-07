/**
 * V2 registry agent identifiers are versioned on-chain:
 *   agentIdentifier = policyId (56 hex) + assetName (64 hex)
 *   assetName       = nonce (2) + rootHash (56) + version (6)
 *
 * SaaS must key verification by the stable root identity, not the full
 * versioned identifier that changes on every registry update.
 */

export const POLICY_ID_HEX_LENGTH = 56;
export const V2_REGISTRY_ASSET_NAME_HEX_LENGTH = 64;
export const V2_REGISTRY_ROOT_HEX_LENGTH = 56;
export const V2_REGISTRY_VERSION_HEX_LENGTH = 6;
export const V2_REGISTRY_NONCE_HEX_LENGTH = 2;

const HEX_RE = /^[0-9a-fA-F]+$/;

export function extractPolicyId(agentIdentifier: string): string {
  if (agentIdentifier.length < POLICY_ID_HEX_LENGTH) {
    throw new Error(
      `agentIdentifier too short: expected at least ${POLICY_ID_HEX_LENGTH} hex chars`,
    );
  }
  const policyId = agentIdentifier.slice(0, POLICY_ID_HEX_LENGTH);
  if (!HEX_RE.test(policyId)) {
    throw new Error("policyId must be hex");
  }
  return policyId.toLowerCase();
}

export function extractAssetName(agentIdentifier: string): string {
  const assetName = agentIdentifier.slice(POLICY_ID_HEX_LENGTH);
  if (assetName.length === 0) {
    throw new Error("agentIdentifier is missing asset name");
  }
  if (!HEX_RE.test(assetName)) {
    throw new Error("assetName must be hex");
  }
  return assetName.toLowerCase();
}

export function isV2RegistryAssetName(assetName: string): boolean {
  return assetName.length === V2_REGISTRY_ASSET_NAME_HEX_LENGTH;
}

/**
 * Stable identity across registry metadata version bumps.
 * For V2 asset names: policyId + root hash (nonce and version stripped).
 * For legacy asset names: returns the full versioned agentIdentifier unchanged.
 */
export function versionIndependentAgentId(agentIdentifier: string): string {
  const policyId = extractPolicyId(agentIdentifier);
  const assetName = extractAssetName(agentIdentifier);

  if (!isV2RegistryAssetName(assetName)) {
    return policyId + assetName;
  }

  return (
    policyId +
    assetName.slice(
      V2_REGISTRY_NONCE_HEX_LENGTH,
      -V2_REGISTRY_VERSION_HEX_LENGTH,
    )
  );
}
