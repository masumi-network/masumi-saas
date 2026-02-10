import { type Agent } from "@/lib/api/agent.client";

export function parseVerificationStatus(
  status: Agent["verificationStatus"],
): string {
  if (status === null || status === undefined) return "Pending";
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "PENDING":
      return "Pending";
    case "REVOKED":
      return "Revoked";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

export function getVerificationStatusBadgeVariant(
  status: Agent["verificationStatus"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "VERIFIED") return "default";
  if (status === "REVOKED" || status === "EXPIRED") return "destructive";
  return "secondary";
}

export function parseAgentRegistrationStatus(
  status: Agent["registrationState"],
): string {
  switch (status) {
    case "RegistrationRequested":
      return "Pending";
    case "RegistrationInitiated":
      return "Registering";
    case "RegistrationConfirmed":
      return "Registered";
    case "RegistrationFailed":
      return "Registration Failed";
    case "DeregistrationRequested":
      return "Pending";
    case "DeregistrationInitiated":
      return "Deregistering";
    case "DeregistrationConfirmed":
      return "Deregistered";
    case "DeregistrationFailed":
      return "Deregistration Failed";
    default:
      return status;
  }
}

export function getRegistrationStatusBadgeVariant(
  status: Agent["registrationState"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "RegistrationConfirmed") return "default";
  if (status.includes("Failed")) return "destructive";
  if (status.includes("Initiated")) return "secondary";
  if (status.includes("Requested")) return "secondary";
  if (status === "DeregistrationConfirmed") return "secondary";
  return "secondary";
}
