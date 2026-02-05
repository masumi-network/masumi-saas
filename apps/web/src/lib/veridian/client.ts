import type { Credential, CredentialServerResponse } from "./types";

const VERIDIAN_CREDENTIAL_SERVER_URL =
  process.env.VERIDIAN_CREDENTIAL_SERVER_URL;
const VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID =
  process.env.VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID;

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
 * Request credential disclosure
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
