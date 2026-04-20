/**
 * Veridian credential server integration (server-only).
 *
 * Thin shim over `@masumi_network/identity-sdk`. Most functions are backed by
 * a singleton `MasumiIdentity` client configured from environment variables.
 * A small number of SaaS-specific helpers (schema SAID lookup, raw OOBI
 * resolution) remain inline.
 */

import {
  MASUMI_IDENTITY_ENDPOINTS,
  MasumiIdentity,
} from "@masumi_network/identity-sdk";

import { veridianConfig } from "@/lib/config/veridian.config";

let cachedSdk: MasumiIdentity | null = null;

function getSdk(): MasumiIdentity {
  if (cachedSdk) return cachedSdk;

  if (!veridianConfig.credentialServerUrl) {
    throw new Error(
      "VERIDIAN_CREDENTIAL_SERVER_URL is required. Please set it in your .env file.",
    );
  }

  cachedSdk = new MasumiIdentity({
    credentialServerUrl: veridianConfig.credentialServerUrl,
    keriaUrl:
      veridianConfig.keriaUrl ?? MASUMI_IDENTITY_ENDPOINTS.production.keriaUrl,
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
 * Resolve an OOBI (Out-of-Band Introduction) on the credential server.
 *
 * Must be called before issuing credentials so the credential server knows
 * about the recipient AID. Not yet exposed by the SDK — kept inline until a
 * future SDK release adds an explicit `resolveOobi` primitive.
 */
export async function resolveOobi(
  oobi: string,
): Promise<{ success: boolean; data: string }> {
  if (!oobi || typeof oobi !== "string" || oobi.trim().length === 0) {
    throw new Error("Invalid OOBI: OOBI must be a non-empty string");
  }

  const url = `${getCredentialServerUrl()}/resolveOobi`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oobi }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      let errorData: { data?: string } = {};
      try {
        errorData = JSON.parse(errorText) as { data?: string };
      } catch {
        // fall through to generic error
      }

      throw new Error(
        errorData.data ||
          `Failed to resolve OOBI: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    return (await response.json()) as { success: boolean; data: string };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to resolve OOBI: ${error.message}`);
    }
    throw new Error("Failed to resolve OOBI: Unknown error");
  }
}

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
