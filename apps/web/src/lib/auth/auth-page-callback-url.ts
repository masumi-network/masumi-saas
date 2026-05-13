import { sanitizeCallbackUrl } from "./callback-url";

export type AuthPageSearchParams = Record<
  string,
  string | string[] | undefined
>;

const OIDC_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

function getFirstValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return value?.find((item) => item.length > 0);
}

function toSearchParams(searchParams: AuthPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "callbackUrl" || key === "callbackURL") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

function resolveAuthPageCallbackUrlFromParams(
  searchParams: AuthPageSearchParams,
): string | undefined {
  const explicitCallbackUrl =
    getFirstValue(searchParams.callbackUrl) ??
    getFirstValue(searchParams.callbackURL);

  const safeExplicitCallbackUrl = sanitizeCallbackUrl(explicitCallbackUrl);
  if (safeExplicitCallbackUrl) {
    return safeExplicitCallbackUrl;
  }

  const authorizeParams = toSearchParams(searchParams);
  const looksLikeOidcAuthorizePrompt =
    authorizeParams.has("client_id") &&
    authorizeParams.has("redirect_uri") &&
    (authorizeParams.has("response_type") ||
      authorizeParams.has("code_challenge") ||
      authorizeParams.has("state"));

  if (!looksLikeOidcAuthorizePrompt) {
    return undefined;
  }

  return sanitizeCallbackUrl(
    `${OIDC_AUTHORIZE_PATH}?${authorizeParams.toString()}`,
  );
}

function parseSignedJsonCookieValue(
  rawValue: string | undefined,
): AuthPageSearchParams | undefined {
  if (!rawValue) {
    return undefined;
  }

  const signatureSeparatorIndex = rawValue.lastIndexOf(".");
  const encodedPayload =
    signatureSeparatorIndex === -1
      ? rawValue
      : rawValue.slice(0, signatureSeparatorIndex);

  try {
    const parsed = JSON.parse(decodeURIComponent(encodedPayload));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }

    return parsed as AuthPageSearchParams;
  } catch {
    return undefined;
  }
}

function hasOidcContinuationHints(searchParams: AuthPageSearchParams): boolean {
  if (
    getFirstValue(searchParams.error) !== undefined ||
    getFirstValue(searchParams.error_description) !== undefined
  ) {
    return false;
  }

  return (
    getFirstValue(searchParams.client_id) !== undefined ||
    getFirstValue(searchParams.code) !== undefined ||
    getFirstValue(searchParams.state) !== undefined ||
    getFirstValue(searchParams.prompt) !== undefined ||
    getFirstValue(searchParams.redirect_uri) !== undefined ||
    getFirstValue(searchParams.response_type) !== undefined
  );
}

export function resolveAuthPageCallbackUrl(
  searchParams: AuthPageSearchParams,
  oidcLoginPromptCookieValue?: string,
): string | undefined {
  const callbackUrlFromParams =
    resolveAuthPageCallbackUrlFromParams(searchParams);
  if (callbackUrlFromParams) {
    return callbackUrlFromParams;
  }

  if (!hasOidcContinuationHints(searchParams)) {
    return undefined;
  }

  const oidcPromptParams = parseSignedJsonCookieValue(
    oidcLoginPromptCookieValue,
  );
  if (!oidcPromptParams) {
    return undefined;
  }

  return resolveAuthPageCallbackUrlFromParams(oidcPromptParams);
}

export function buildAuthPageHref(
  pathname: string,
  callbackUrl?: string,
): string {
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);
  if (!safeCallbackUrl) {
    return pathname;
  }

  return `${pathname}?${new URLSearchParams({
    callbackUrl: safeCallbackUrl,
  }).toString()}`;
}
