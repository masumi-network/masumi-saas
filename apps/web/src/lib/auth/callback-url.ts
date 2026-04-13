const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.BETTER_AUTH_URL?.trim() ||
  "http://localhost:2999";
const OIDC_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

function isSafeOidcAuthorizeCallback(parsed: URL): boolean {
  if (parsed.pathname !== OIDC_AUTHORIZE_PATH) {
    return true;
  }

  if (
    parsed.searchParams.has("error") ||
    parsed.searchParams.has("error_description")
  ) {
    return false;
  }

  return Boolean(parsed.searchParams.get("client_id"));
}

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
  if (!isSafeOidcAuthorizeCallback(parsed)) return undefined;

  return parsed.pathname + parsed.search + parsed.hash;
}

export function buildAbsoluteCallbackUrl(
  url: string | undefined,
): string | undefined {
  const safePath = sanitizeCallbackUrl(url);
  if (!safePath) return undefined;
  return new URL(safePath, APP_ORIGIN).toString();
}
