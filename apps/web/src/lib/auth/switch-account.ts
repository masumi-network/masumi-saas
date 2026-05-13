import { sanitizeCallbackUrl } from "./callback-url";

export function buildSwitchAccountSignInHref(callbackUrl?: string): string {
  const redirectTo = sanitizeCallbackUrl(callbackUrl) ?? "/";
  return `/signin?callbackUrl=${encodeURIComponent(redirectTo)}`;
}
