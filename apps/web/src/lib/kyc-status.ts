export type KycStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null;

/** Returns the translation key for KYC status badge value (App.Agents.status.*) */
export function getKycStatusBadgeKey(
  status: KycStatus,
): "verifiedValue" | "pendingValue" | "rejectedValue" | "reviewValue" {
  if (status === "APPROVED") return "verifiedValue";
  if (status === "REJECTED") return "rejectedValue";
  if (status === "REVIEW") return "reviewValue";
  return "pendingValue";
}

/** Returns the Badge variant for KYC status */
export function getKycStatusBadgeVariant(
  status: KycStatus,
): "default" | "secondary" | "destructive" | "success" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}
