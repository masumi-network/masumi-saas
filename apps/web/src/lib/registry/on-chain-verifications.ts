import type { RegistryAgentIdentifierMetadata } from "@/lib/payment-node/schemas";
import type { Verification } from "@/lib/payment-node/verification-schemas";

export function getOnChainVerifications(
  metadata: RegistryAgentIdentifierMetadata | null | undefined,
): Verification[] | null {
  const verifications = metadata?.Metadata?.verifications;
  if (verifications == null) {
    return null;
  }
  return verifications;
}

export function hasOnChainVerification(
  metadata: RegistryAgentIdentifierMetadata | null | undefined,
): boolean {
  const verifications = getOnChainVerifications(metadata);
  return Boolean(verifications && verifications.length > 0);
}
