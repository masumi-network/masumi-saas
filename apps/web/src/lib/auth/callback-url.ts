/**
 * Returns a safe same-origin path for redirects, or undefined if invalid.
 * Prevents open redirects: allows "/" and "/path" but rejects "//evil.com".
 */
export function sanitizeCallbackUrl(
  url: string | undefined,
): string | undefined {
  if (url == null || url === "") return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return undefined;
}
