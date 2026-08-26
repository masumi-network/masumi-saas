/**
 * Privacy policy URL used by signup flows, footers, cookie consent, and emails.
 * Override with NEXT_PUBLIC_PRIVACY_POLICY_URL for all consumers.
 */
export const DEFAULT_PRIVACY_POLICY_URL = "https://www.masumi.network/privacy";

/** @deprecated Legacy vendor URL — must not appear in active SaaS UI. */
export const LEGACY_PRIVACY_POLICY_URL =
  "https://www.house-of-communication.com/de/en/footer/privacy-policy.html";

export const PRIVACY_POLICY_URL =
  process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim() ||
  DEFAULT_PRIVACY_POLICY_URL;

/** External privacy links open in a new tab with safe referrer policy. */
export const PRIVACY_POLICY_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
