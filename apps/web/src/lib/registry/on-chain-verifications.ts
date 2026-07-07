import type { RegistryAgentIdentifierMetadata } from "@/lib/payment-node/schemas";
import {
  type Verification,
  VerificationMethod,
} from "@/lib/payment-node/verification-schemas";

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

export function findOnChainKeriVerification(
  verifications: Verification[] | null | undefined,
  schemaSaid: string,
): Verification | undefined {
  if (!verifications?.length) return undefined;
  return verifications.find(
    (entry) =>
      entry.method === VerificationMethod.KeriAcdc &&
      entry.schema.said === schemaSaid,
  );
}
