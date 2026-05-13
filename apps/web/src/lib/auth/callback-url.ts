const OIDC_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:2999"
  );
}

export function buildAbsoluteAppUrl(url: string): string {
  const appOrigin = getAppOrigin();
  const parsed = new URL(url, appOrigin);
  return new URL(
    `${parsed.pathname}${parsed.search}${parsed.hash}`,
    appOrigin,
  ).toString();
}

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

  const appOrigin = getAppOrigin();
  let parsed: URL;
  try {
    parsed = new URL(url, appOrigin);
  } catch {
    return undefined;
  }

  if (parsed.origin !== new URL(appOrigin).origin) return undefined;
  if (!isSafeOidcAuthorizeCallback(parsed)) return undefined;

  return parsed.pathname + parsed.search + parsed.hash;
}

export function buildAbsoluteCallbackUrl(
  url: string | undefined,
): string | undefined {
  const safePath = sanitizeCallbackUrl(url);
  if (!safePath) return undefined;
  return new URL(safePath, getAppOrigin()).toString();
}
