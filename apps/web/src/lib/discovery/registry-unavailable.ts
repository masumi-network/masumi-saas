export function isRegistryUnavailableError(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("registry service is not configured") ||
    normalized.includes("registry discovery is currently unavailable")
  );
}
