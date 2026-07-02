import type { RegistryRequestState } from "@/lib/payment-node/schemas";

import type { AgentOnChainVerificationStatus } from "./agent-on-chain-verification-status";

/** Registry states where verification anchors are being written on-chain. */
export const REGISTRY_UPDATE_PENDING_STATES = new Set<RegistryRequestState>([
  "UpdateRequested",
  "UpdateInitiated",
]);

export type VerificationPresentation =
  | "verifiedOnChain"
  | "updateInProgress"
  | "onChainPending"
  | "pending"
  | "revoked"
  | "expired";

type OnChainPresentationInput = Pick<
  AgentOnChainVerificationStatus,
  "verified" | "resolutionSource" | "registryState" | "hasAnchors"
>;

/**
 * User-facing verification presentation. Prefers on-chain truth over SaaS DB
 * `verificationStatus` so we never claim "verified on Masumi network" when
 * anchors are still pending or a registry update is in flight.
 */
export function deriveVerificationPresentation(params: {
  dbStatus: string;
  onChain: OnChainPresentationInput | null;
}): VerificationPresentation {
  const { dbStatus, onChain } = params;

  if (onChain?.verified && onChain.resolutionSource === "on-chain") {
    return "verifiedOnChain";
  }

  if (
    onChain?.registryState &&
    REGISTRY_UPDATE_PENDING_STATES.has(onChain.registryState)
  ) {
    return "updateInProgress";
  }

  if (dbStatus === "REVOKED") return "revoked";
  if (dbStatus === "EXPIRED") return "expired";

  if (dbStatus === "VERIFIED") {
    return "onChainPending";
  }

  return "pending";
}

export function isMasumiNetworkVerified(
  presentation: VerificationPresentation,
): boolean {
  return presentation === "verifiedOnChain";
}
