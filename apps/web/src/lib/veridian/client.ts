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
        errorData = JSON.parse(errorText) as { data?: string };
      } catch {
        // If JSON parsing fails, errorData remains empty and we'll use the fallback error message
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
        errorData = JSON.parse(errorText) as { data?: string };
      } catch {
        // If JSON parsing fails, errorData remains empty and we'll use the fallback error message
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
 * @returns The key state containing the public key (first key from the array)
 * @throws Error if the request fails
 */
export async function fetchKeyState(aid: string): Promise<{
  k: string; // Public key (extracted from array)
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
      k?: string | string[]; // KERI protocol: k is an array of signing keys for multi-sig support
      [key: string]: unknown;
    };

    if (!data.k) {
      throw new Error("Key state does not contain public key");
    }

    // Extract the first key from the array (KERI supports weighted multi-signature)
    const publicKey =
      Array.isArray(data.k) && data.k.length > 0
        ? data.k[0]
        : typeof data.k === "string"
          ? data.k
          : null;

    if (!publicKey || typeof publicKey !== "string") {
      throw new Error(
        "Invalid public key format: expected string or non-empty array of strings",
      );
    }

    return { k: publicKey, ...data };
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
 * @returns true if the signature is valid, false if the signature does not match
 * @throws Error if verification fails due to configuration or network issues (e.g., KERIA unavailable, misconfigured)
 */
export async function verifyKeriSignature(
  signature: string,
  message: string,
  aid: string,
): Promise<boolean> {
  // Fetch the key state to get the public key
  // This will throw if KERIA is unavailable or misconfigured
  const keyState = await fetchKeyState(aid);
  const publicKeyBase64 = keyState.k;

  if (!publicKeyBase64) {
    throw new Error("Public key not found in key state");
  }

  // Decode the public key and signature from base64url
  // KERI uses base64url encoding (RFC 4648 Section 5)
  let publicKeyBuffer: Buffer;
  let signatureBuffer: Buffer;

  try {
    publicKeyBuffer = Buffer.from(publicKeyBase64, "base64url");
    signatureBuffer = Buffer.from(signature, "base64url");
  } catch (error) {
    throw new Error(
      `Failed to decode public key or signature: ${
        error instanceof Error ? error.message : "Invalid base64url encoding"
      }`,
    );
  }

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

    // crypto.verify returns true if signature is valid, false otherwise
    // This is the only case where we return false (signature doesn't match)
    return crypto.verify(null, messageBuffer, keyObject, signatureBuffer);
  } catch (error) {
    // If crypto operations fail (e.g., invalid key format, Node.js version issue),
    // this is a configuration/implementation error, not a signature mismatch
    throw new Error(
      `Ed25519 signature verification failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please ensure Node.js version 12+ is used and VERIDIAN_KERIA_URL is configured.`,
    );
  }
}
