/**
 * Privacy policy URL used by signup flows and magic-link email consent copy.
 * Override with NEXT_PUBLIC_PRIVACY_POLICY_URL for all consumers.
 */
export const PRIVACY_POLICY_URL =
  process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim() ||
  "https://www.house-of-communication.com/de/en/footer/privacy-policy.html";
