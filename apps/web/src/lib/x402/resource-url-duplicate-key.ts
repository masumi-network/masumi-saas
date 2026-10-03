/** Strip trailing slashes from path (except bare `/`) so probe and batch dedup match. */
function normalizeHttpResourceHref(parsed: URL): string {
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  }
  return parsed.href;
}

/** Canonical href for persistence (same normalization as duplicate key, original casing). */
export function canonicalX402ResourceUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return normalizeHttpResourceHref(parsed);
  } catch {
    return null;
  }
}

/** Normalized key for comparing x402 resource URLs (href, lowercase). */
export function resourceUrlDuplicateKey(url: string): string | null {
  const canonical = canonicalX402ResourceUrl(url);
  return canonical ? canonical.toLowerCase() : null;
}
