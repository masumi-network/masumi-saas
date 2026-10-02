/** Errors that should fail the draft or stop polling; transient outages stay pending. */
export function isPermanentNetworkRegistrationError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("rejected") ||
    lower.includes("failed on the network") ||
    lower.includes("not found") ||
    lower.includes("missing registration") ||
    lower.includes("invalid")
  );
}
