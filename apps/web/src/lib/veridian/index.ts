/**
 * Veridian credential server integration (server-only).
 *
 * Thin shim over `@masumi_network/identity-sdk`. Most functions are backed by
 * a singleton `MasumiIdentity` client configured from environment variables.
 * A small number of SaaS-specific helpers (schema SAID lookup, contact OOBI
 * lookup) remain inline.
 */

import { MasumiIdentity } from "@masumi_network/identity-sdk";

import { veridianConfig } from "@/lib/config/veridian.config";

/**
 * Sentinel URL passed to the SDK when VERIDIAN_KERIA_URL is not configured.
 *
 * The SDK's constructor requires a non-empty `keriaUrl` string, but none of
 * the shim methods currently exposed to masumi-saas (issuer OOBI, contact
 * credentials, connection check, credential issuance) actually hit KERIA —
 * only signature-verification flows do. Mirror the pre-SDK behavior of
 * `getKeriaUrl()` which only threw lazily, inside the signature path, by
 * keeping the SDK happy at construction time and letting KERIA-bound calls
 * fail noisily on this reserved `.invalid` TLD if anyone reaches for them
 * without setting VERIDIAN_KERIA_URL first.
 */
const UNSET_KERIA_URL = "https://veridian-keria-url-not-configured.invalid";

let cachedSdk: MasumiIdentity | null = null;

/**
 * Build (or reuse) the SDK client.
 *
 * Fails fast only on VERIDIAN_CREDENTIAL_SERVER_URL, which every currently
 * exposed method needs. KERIA is treated as optional to preserve the
 * original lazy-throw semantics.
 */
function getSdk(): MasumiIdentity {
  if (cachedSdk) return cachedSdk;

  if (!veridianConfig.credentialServerUrl) {
    throw new Error(
      "VERIDIAN_CREDENTIAL_SERVER_URL is required. Please set it in your .env file.",
    );
  }

  cachedSdk = new MasumiIdentity({
    credentialServerUrl: veridianConfig.credentialServerUrl,
    keriaUrl: veridianConfig.keriaUrl ?? UNSET_KERIA_URL,
  });

  return cachedSdk;
}

export function getCredentialServerUrl(): string {
  if (!veridianConfig.credentialServerUrl) {
    throw new Error(
      "VERIDIAN_CREDENTIAL_SERVER_URL is required. Please set it in your .env file.",
    );
  }
  return veridianConfig.credentialServerUrl;
}

export function getAgentVerificationSchemaSaid(): string {
  if (!veridianConfig.agentVerificationSchemaSaid) {
    throw new Error(
      "VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID is required. Please set it in your .env file.",
    );
  }
  return veridianConfig.agentVerificationSchemaSaid;
}

export async function getIssuerOobi(): Promise<string> {
  return getSdk().getIssuerOobi();
}

export async function fetchContactCredentials(aid: string) {
  return getSdk().getCredentialsForAid(aid);
}

export async function checkContactExists(aid: string): Promise<boolean> {
  return getSdk().isAidConnected(aid);
}

/**
 * Issue a credential to an AID.
 *
 * Preserves the legacy positional signature (schemaSaid, aid, attributes) that
 * call sites in masumi-saas depend on; forwards to the SDK's object-shaped
 * method under the hood.
 */
export async function issueCredential(
  schemaSaid: string,
  aid: string,
  attributes?: Record<string, unknown>,
) {
  return getSdk().issueCredential({ schemaSaid, aid, attributes });
}

/**
 * Connect a wallet AID to the credential server via its OOBI.
 *
 * Must be called before issuing credentials so the server knows how to reach
 * the recipient. Delegates to {@link MasumiIdentity.connectToAid}.
 */
export async function connectToAid(
  oobi: string,
): Promise<{ success: boolean; data: string }> {
  return getSdk().connectToAid(oobi);
}

/** @deprecated Prefer {@link connectToAid} — kept for existing call sites. */
export const resolveOobi = connectToAid;

export type {
  Credential,
  CredentialValidationOptions,
  CredentialValidationResult,
  FormattedCredential,
} from "@masumi_network/identity-sdk";
export {
  extractCredentialAttributes,
  findCredentialBySchema,
  formatCredential,
  validateCredential,
} from "@masumi_network/identity-sdk";
