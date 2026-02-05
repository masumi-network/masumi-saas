import crypto from "crypto";

import type { Credential, CredentialServerResponse } from "./types";

const VERIDIAN_CREDENTIAL_SERVER_URL =
  process.env.VERIDIAN_CREDENTIAL_SERVER_URL;
const VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID =
  process.env.VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID;
const VERIDIAN_KERIA_URL = process.env.VERIDIAN_KERIA_URL;

/**
 * Get the credential server URL
 * @returns The credential server base URL
 */
export function getCredentialServerUrl(): string {
  if (!VERIDIAN_CREDENTIAL_SERVER_URL) {
    throw new Error(
      "VERIDIAN_CREDENTIAL_SERVER_URL is required. Please set it in your .env file.",
    );
  }
  return VERIDIAN_CREDENTIAL_SERVER_URL;
}

/**
 * Get the expected schema SAID for agent verification
 * @returns The schema SAID that should be used for agent verification
 * @throws Error if VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID is not set
 */
export function getAgentVerificationSchemaSaid(): string {
  if (!VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID) {
    throw new Error(
      "VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID is required. Please set it in your .env file.",
    );
  }
  return VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID;
}

/**
 * Get the issuer's OOBI (Out-of-Band Introduction) URL
 * This is used to establish a connection from the wallet to the credential server
 * @returns The issuer's OOBI URL
 * @throws Error if the request fails
 */
export async function getIssuerOobi(): Promise<string> {
  const credentialServerUrl = getCredentialServerUrl();
  const url = `${credentialServerUrl}/keriOobi`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch issuer OOBI: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { success: boolean; data: string };
    if (!data.success || !data.data) {
      throw new Error("Invalid response from credential server");
    }

    return data.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get issuer OOBI: ${error.message}`);
    }
    throw new Error("Failed to get issuer OOBI: Unknown error");
  }
}

/**
 * Fetch all credentials for a KERI identifier (AID)
 * @param aid - The KERI identifier (AID) to fetch credentials for
 * @returns Array of credentials associated with the identifier
 * @throws Error if the request fails
 */
export async function fetchContactCredentials(
  aid: string,
): Promise<Credential[]> {
  if (!aid || typeof aid !== "string" || aid.trim().length === 0) {
    throw new Error("Invalid AID: AID must be a non-empty string");
  }

  const credentialServerUrl = getCredentialServerUrl();
  const url = `${credentialServerUrl}/contactCredentials?contactId=${encodeURIComponent(aid)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Failed to fetch credentials: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as CredentialServerResponse;
    return data.data || [];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch contact credentials: ${error.message}`);
    }
    throw new Error("Failed to fetch contact credentials: Unknown error");
  }
}

/**
 * Resolve an OOBI (Out-of-Band Introduction) for an AID
 * This must be called before issuing credentials to ensure the credential server knows about the recipient
 * @param oobi - The OOBI URL to resolve
 * @returns Response from the credential server
 * @throws Error if the request fails
 */
export async function resolveOobi(
  oobi: string,
): Promise<{ success: boolean; data: string }> {
  if (!oobi || typeof oobi !== "string" || oobi.trim().length === 0) {
    throw new Error("Invalid OOBI: OOBI must be a non-empty string");
  }

  const credentialServerUrl = getCredentialServerUrl();
  const url = `${credentialServerUrl}/resolveOobi`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ oobi }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      let errorData: { data?: string } = {};
      try {
        errorData = (await response.json()) as { data?: string };
      } catch {
        // If JSON parsing fails, use the error text
      }

      throw new Error(
        errorData.data ||
          `Failed to resolve OOBI: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as { success: boolean; data: string };
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to resolve OOBI: ${error.message}`);
    }
    throw new Error("Failed to resolve OOBI: Unknown error");
  }
}

/**
 * Issue a credential to a KERI identifier (AID)
 * @param schemaSaid - The schema SAID to issue
 * @param aid - The KERI identifier (AID) to issue the credential to
 * @param attributes - Optional attributes to include in the credential
 * @returns Response from the credential server
 * @throws Error if the request fails
 */
export async function issueCredential(
  schemaSaid: string,
  aid: string,
  attributes?: Record<string, unknown>,
): Promise<{ success: boolean; data: string }> {
  if (
    !schemaSaid ||
    typeof schemaSaid !== "string" ||
    schemaSaid.trim().length === 0
  ) {
    throw new Error("Invalid schemaSaid: must be a non-empty string");
  }

  if (!aid || typeof aid !== "string" || aid.trim().length === 0) {
    throw new Error("Invalid AID: AID must be a non-empty string");
  }

  const credentialServerUrl = getCredentialServerUrl();
  const url = `${credentialServerUrl}/issueAcdcCredential`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Request body structure from credential server
  const requestBody: any = {
    schemaSaid,
    aid,
  };

  if (attributes && Object.keys(attributes).length > 0) {
    requestBody.attribute = attributes;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      let errorData: { data?: string } = {};
      try {
        errorData = (await response.json()) as { data?: string };
      } catch {
        // If JSON parsing fails, use the error text
      }

      throw new Error(
        errorData.data ||
          `Failed to issue credential: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as { success: boolean; data: string };
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to issue credential: ${error.message}`);
    }
    throw new Error("Failed to issue credential: Unknown error");
  }
}

/**
 * Get the KERIA URL (connect URL, not boot URL)
 * @returns The KERIA base URL (should be the connect URL on port 3901, not the boot URL on port 3903)
 * @throws Error if VERIDIAN_KERIA_URL is not set
 */
function getKeriaUrl(): string {
  if (!VERIDIAN_KERIA_URL) {
    throw new Error(
      "VERIDIAN_KERIA_URL is required for signature verification. Please set it in your .env file. Use the KERIA connect URL (port 3901), not the boot URL.",
    );
  }
  return VERIDIAN_KERIA_URL;
}

/**
 * Fetch the key state for a KERI identifier (AID) from KERIA
 * @param aid - The KERI identifier (AID) to fetch the key state for
 * @returns The key state containing the public key
 * @throws Error if the request fails
 */
export async function fetchKeyState(aid: string): Promise<{
  k: string; // Public key
  [key: string]: unknown;
}> {
  if (!aid || typeof aid !== "string" || aid.trim().length === 0) {
    throw new Error("Invalid AID: AID must be a non-empty string");
  }

  const keriaUrl = getKeriaUrl();
  const url = `${keriaUrl}/identifiers/${encodeURIComponent(aid)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Failed to fetch key state: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      k?: string;
      [key: string]: unknown;
    };

    if (!data.k) {
      throw new Error("Key state does not contain public key");
    }

    return data as { k: string; [key: string]: unknown };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch key state: ${error.message}`);
    }
    throw new Error("Failed to fetch key state: Unknown error");
  }
}

/**
 * Verify a KERI signature
 * @param signature - The base64-encoded signature
 * @param message - The message that was signed
 * @param aid - The KERI identifier (AID) that should have signed the message
 * @returns true if the signature is valid, false otherwise
 * @throws Error if verification fails due to configuration or network issues
 */
export async function verifyKeriSignature(
  signature: string,
  message: string,
  aid: string,
): Promise<boolean> {
  try {
    // Fetch the key state to get the public key
    const keyState = await fetchKeyState(aid);
    const publicKeyBase64 = keyState.k;

    if (!publicKeyBase64) {
      throw new Error("Public key not found in key state");
    }

    // Decode the public key and signature from base64url
    // KERI uses base64url encoding (RFC 4648 Section 5)
    const publicKeyBuffer = Buffer.from(publicKeyBase64, "base64url");
    const signatureBuffer = Buffer.from(signature, "base64url");

    // Ed25519 signatures are 64 bytes and public keys are 32 bytes
    if (publicKeyBuffer.length !== 32) {
      throw new Error(
        `Invalid public key length: expected 32 bytes, got ${publicKeyBuffer.length}`,
      );
    }

    if (signatureBuffer.length !== 64) {
      throw new Error(
        `Invalid signature length: expected 64 bytes, got ${signatureBuffer.length}`,
      );
    }

    // Verify the Ed25519 signature using Node.js crypto
    // Node.js 12+ supports Ed25519, but TypeScript types may not fully reflect this
    const messageBuffer = Buffer.from(message, "utf8");

    // Use crypto.verify with Ed25519
    // The 'ed25519' algorithm doesn't require a hash function
    try {
      // Create public key object - Node.js accepts raw Ed25519 keys as Buffer
      // TypeScript types don't fully support Ed25519 raw format, so we use type assertion
      const keyInput = {
        key: publicKeyBuffer,
        format: "raw" as const,
        type: "ed25519" as const,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node.js crypto types don't fully support Ed25519 raw format
      const keyObject = crypto.createPublicKey(keyInput as any);

      return crypto.verify(null, messageBuffer, keyObject, signatureBuffer);
    } catch (error) {
      // If verification fails, throw an error with details
      throw new Error(
        `Ed25519 signature verification failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please ensure Node.js version 12+ is used and VERIDIAN_KERIA_URL is configured.`,
      );
    }
  } catch (error) {
    // If KERIA is not configured or unavailable, we can't verify
    // Log the error but don't throw - let the caller decide how to handle
    console.error("Failed to verify KERI signature:", error);
    return false;
  }
}
