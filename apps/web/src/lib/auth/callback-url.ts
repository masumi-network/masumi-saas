const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

/**
 * Returns a safe same-origin path for redirects, or undefined if invalid.
 * Parses the URL against the app origin so encoded slashes, backslashes,
 * and protocol-relative URLs are properly resolved before the check.
 */
export function sanitizeCallbackUrl(
  url: string | undefined,
): string | undefined {
  if (url == null || url === "") return undefined;

  let parsed: URL;
  try {
    parsed = new URL(url, APP_ORIGIN);
  } catch {
    return undefined;
  }

  if (parsed.origin !== new URL(APP_ORIGIN).origin) return undefined;

  return parsed.pathname + parsed.search + parsed.hash;
}
