/**
 * Shared agent API types. Used by server functions and client/UI.
 */

import type { AgentPricing } from "@/lib/utils";

export type Agent = {
  id: string;
  name: string;
  description: string | null;
  extendedDescription: string | null;
  apiUrl: string;
  tags: string[];
  icon: string | null;
  metadata?: string | null;
  agentIdentifier: string | null;
  networkIdentifier: string | null;
  pricing: AgentPricing | null;
  registrationState:
    | "RegistrationRequested"
    | "RegistrationInitiated"
    | "RegistrationConfirmed"
    | "RegistrationFailed"
    | "DeregistrationRequested"
    | "DeregistrationInitiated"
    | "DeregistrationConfirmed"
    | "DeregistrationFailed";
  verificationStatus: "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED" | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GetAgentsResult =
  | { success: true; data: Agent[]; nextCursor: string | null }
  | { success: false; error: string };

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Sanitized VC row for the Credentials tab (no signing material). */
export type AgentVerificationCredentialSummary = {
  localCredentialRecordId: string;
  credentialId: string;
  schemaSaid: string;
  aid: string;
  credentialStatus: "PENDING" | "ISSUED" | "REVOKED" | "EXPIRED";
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUpdatedAt: string;
  claimedRegistryAgentIdentifier: string | null;
  credentialAgentDisplayName: string | null;
  credentialAgentApiUrl: string | null;
  registryAgentIdentifier: string | null;
};
