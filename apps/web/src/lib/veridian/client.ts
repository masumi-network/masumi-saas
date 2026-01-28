import "server-only";

import type { Credential, CredentialServerResponse } from "./types";

const VERIDIAN_CREDENTIAL_SERVER_URL =
  process.env.VERIDIAN_CREDENTIAL_SERVER_URL;
const VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID =
  process.env.VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID ||
  "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO"; // Default: Foundation Employee

if (!VERIDIAN_CREDENTIAL_SERVER_URL) {
  throw new Error(
    "VERIDIAN_CREDENTIAL_SERVER_URL is required. Please set it in your .env file.",
  );
}

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
 */
export function getAgentVerificationSchemaSaid(): string {
  return VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID;
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
      // Re-throw with context
      throw new Error(`Failed to fetch contact credentials: ${error.message}`);
    }
    throw new Error("Failed to fetch contact credentials: Unknown error");
  }
}

/**
 * Request credential disclosure (legacy endpoint, not actively used)
 * @param schemaSaid - The schema SAID to request
 * @param aid - The KERI identifier (AID)
 * @param attributes - Optional attributes to include in the request
 * @returns Response from the credential server
 * @throws Error if the request fails
 */
export async function requestDisclosure(
  schemaSaid: string,
  aid: string,
  attributes?: Record<string, string>,
): Promise<unknown> {
  if (!schemaSaid || typeof schemaSaid !== "string") {
    throw new Error("Invalid schemaSaid: must be a non-empty string");
  }

  if (!aid || typeof aid !== "string" || aid.trim().length === 0) {
    throw new Error("Invalid AID: AID must be a non-empty string");
  }

  const credentialServerUrl = getCredentialServerUrl();
  const url = `${credentialServerUrl}/requestDisclosure`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Request body structure from credential server
  const requestBody: any = {
    schemaSaid,
    aid,
  };

  // Add attributes if provided
  if (attributes && Object.keys(attributes).length > 0) {
    const attribute: Record<string, string> = {};
    Object.entries(attributes).forEach(([key, value]) => {
      if (key && value) {
        attribute[key] = value;
      }
    });

    if (Object.keys(attribute).length > 0) {
      requestBody.attribute = attribute;
    }
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
      throw new Error(
        `Failed to request disclosure: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to request disclosure: ${error.message}`);
    }
    throw new Error("Failed to request disclosure: Unknown error");
  }
}
