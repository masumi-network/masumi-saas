import { type Agent } from "@/lib/api/agent.client";

/**
 * Two distinct concepts for agent status:
 *
 * 1. REGISTRATION STATUS (registrationState) - from masumi payment service
 *    Whether the agent is registered to receive payments. Values: Registered, Pending,
 *    Registering, Registration Failed, Deregistering, Deregistered, etc.
 *
 * 2. VERIFICATION STATUS (verificationStatus) - Veridian credential
 *    Whether the agent has a valid verifiable credential (KYC-linked). Used for the
 *    verification badge (shield icon). Values: Verified, Pending, Revoked, Expired.
 */

/** Returns the translation key for verification status (credential badge). */
export function getVerificationStatusKey(
  status: Agent["verificationStatus"],
): "verified" | "pending" | "revoked" | "expired" {
  if (status === null || status === undefined) return "pending";
  switch (status) {
    case "VERIFIED":
      return "verified";
    case "PENDING":
      return "pending";
    case "REVOKED":
      return "revoked";
    case "EXPIRED":
      return "expired";
    default:
      return "pending";
  }
}

export function getVerificationStatusBadgeVariant(
  status: Agent["verificationStatus"],
):
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "outline"
  | "outline-muted" {
  if (status === "VERIFIED") return "success";
  if (status === "REVOKED" || status === "EXPIRED") return "destructive";
  return "secondary";
}

type RegistrationStatusKey =
  | "registered"
  | "pending"
  | "registering"
  | "registrationFailed"
  | "deregistering"
  | "deregistered"
  | "deregistrationFailed";

/** Returns the translation key for registration status (payment service). */
export function getRegistrationStatusKey(
  status: Agent["registrationState"],
): RegistrationStatusKey {
  const key = REGISTRATION_STATUS_KEYS[status];
  return key ?? "pending";
}

const REGISTRATION_STATUS_KEYS: Record<
  Agent["registrationState"],
  RegistrationStatusKey
> = {
  RegistrationRequested: "pending",
  RegistrationInitiated: "registering",
  RegistrationConfirmed: "registered",
  RegistrationFailed: "registrationFailed",
  DeregistrationRequested: "pending",
  DeregistrationInitiated: "deregistering",
  DeregistrationConfirmed: "deregistered",
  DeregistrationFailed: "deregistrationFailed",
};

export function getRegistrationStatusBadgeVariant(
  status: Agent["registrationState"],
): "default" | "secondary" | "destructive" | "outline" | "outline-muted" {
  if (status === "RegistrationConfirmed") return "default";
  if (status.includes("Failed")) return "destructive";
  if (status.includes("Initiated")) return "secondary";
  if (status.includes("Requested")) return "secondary";
  if (status === "DeregistrationConfirmed") return "secondary";
  return "secondary";
}
