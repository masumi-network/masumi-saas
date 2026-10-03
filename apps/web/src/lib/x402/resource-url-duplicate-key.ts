/** Normalized key for comparing x402 resource URLs (href, lowercase). */
export function resourceUrlDuplicateKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href.toLowerCase();
  } catch {
    return null;
  }
}
