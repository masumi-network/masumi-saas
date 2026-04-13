import { sanitizeCallbackUrl } from "./callback-url";

const MAGIC_LINK_CONTINUE_PATH = "/magic-link/continue";
const OIDC_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

export function encodeMagicLinkContinuation(callbackUrl: string): string {
  return Buffer.from(callbackUrl, "utf8").toString("base64url");
}

export function decodeMagicLinkContinuation(
  encodedCallbackUrl: string | undefined,
): string | undefined {
  if (!encodedCallbackUrl) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(encodedCallbackUrl, "base64url").toString(
      "utf8",
    );
    return sanitizeCallbackUrl(decoded);
  } catch {
    return undefined;
  }
}

export function buildMagicLinkCallbackUrl(
  callbackUrl: string | undefined,
): string {
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl) ?? "/";

  if (!safeCallbackUrl.startsWith(OIDC_AUTHORIZE_PATH)) {
    return safeCallbackUrl;
  }

  const params = new URLSearchParams({
    flow: encodeMagicLinkContinuation(safeCallbackUrl),
  });

  return `${MAGIC_LINK_CONTINUE_PATH}?${params.toString()}`;
}
