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
  verificationStatus:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "REVIEW"
    | "VERIFIED"
    | "REVOKED"
    | "EXPIRED"
    | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GetAgentsResult =
  | { success: true; data: Agent[]; nextCursor: string | null }
  | { success: false; error: string };

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
