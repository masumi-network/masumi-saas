function parseFeatureFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (!value) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

const DEFAULT_VERIFIABLE_CREDENTIALS_SDK_DOC_URL =
  "https://masumi-identity-sdk-docs-8lhm9.ondigitalocean.app/api-reference/credentials" as const;

/**
 * Masumi Identity SDK — Verifiable Credentials API reference (shown in agent verification UI).
 * `NEXT_PUBLIC_*` is inlined into the client bundle; restart `pnpm dev` after changing.
 */
export const verifiableCredentialsSdkDocUrl =
  process.env.NEXT_PUBLIC_VERIFIABLE_CREDENTIALS_SDK_DOC_URL?.trim() ||
  DEFAULT_VERIFIABLE_CREDENTIALS_SDK_DOC_URL;

export const verificationConfig = {
  sumsubKycEnabled: parseFeatureFlag(
    process.env.NEXT_PUBLIC_ENABLE_SUMSUB_KYC,
    false,
  ),
  sumsubKybEnabled: parseFeatureFlag(
    process.env.NEXT_PUBLIC_ENABLE_SUMSUB_KYB,
    false,
  ),
  veridianAgentVerificationEnabled: parseFeatureFlag(
    process.env.NEXT_PUBLIC_ENABLE_VERIDIAN_AGENT_VERIFICATION,
    false,
  ),
} as const;

export const verificationFeatureCopy = {
  kycUnavailableTitle: "Identity verification is temporarily unavailable",
  kycUnavailableDescription:
    "New identity verification requests are disabled for now. Existing verification records remain visible.",
  returnToDashboardLabel: "Back to dashboard",
  kybUnavailableDescription:
    "Organization verification is temporarily unavailable.",
  agentVerificationUnavailableTitle:
    "Agent verification is temporarily unavailable",
  agentVerificationUnavailableDescription:
    "New agent verification requests are disabled for now. Existing verification badges remain visible.",
} as const;

export function isKycVerificationEnabled(): boolean {
  return verificationConfig.sumsubKycEnabled;
}

export function isKybVerificationEnabled(): boolean {
  return verificationConfig.sumsubKybEnabled;
}

export function isVeridianAgentVerificationEnabled(): boolean {
  return verificationConfig.veridianAgentVerificationEnabled;
}

export function isAgentVerificationFlowEnabled(): boolean {
  return (
    verificationConfig.sumsubKycEnabled &&
    verificationConfig.veridianAgentVerificationEnabled
  );
}
