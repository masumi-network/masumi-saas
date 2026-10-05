/** Canonical href for persistence (normalizes scheme and host, preserves resource path and query). */
export function canonicalX402ResourceUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/** Normalized key for comparing x402 resource URLs. */
export function resourceUrlDuplicateKey(url: string): string | null {
  return canonicalX402ResourceUrl(url);
}
