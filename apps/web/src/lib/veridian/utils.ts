import type {
  Credential,
  CredentialValidationOptions,
  CredentialValidationResult,
  FormattedCredential,
} from "./types";

/**
 * Extract credential attributes from the SAD (Self-Addressing Data) structure
 * Filters out metadata fields (d, i, dt, ri, s) and returns only actual attributes
 * @param credential - The credential to extract attributes from
 * @returns Record of credential attributes
 */
export function extractCredentialAttributes(
  credential: Credential,
): Record<string, unknown> {
  const attributes = credential.sad?.a || {};
  const credentialAttributes: Record<string, unknown> = {};

  // Filter out metadata fields and keep only actual attributes
  Object.keys(attributes).forEach((key) => {
    if (!["d", "i", "dt", "ri", "s"].includes(key)) {
      credentialAttributes[key] = attributes[key];
    }
  });

  return credentialAttributes;
}

/**
 * Format a raw credential into a structured format for API responses
 * @param credential - The raw credential from the server
 * @returns Formatted credential with extracted data
 */
export function formatCredential(credential: Credential): FormattedCredential {
  const attributes = extractCredentialAttributes(credential);
  const schemaSaid = credential.sad?.s || credential.schema?.$id || "";
  const credentialType =
    credential.schema?.credentialType ||
    credential.schema?.title ||
    "Unknown Credential Type";
  const credentialTitle = credential.schema?.title || "";
  const issueeId = credential.sad?.a?.i || "";
  const issueeAid = credential.sad?.i || "";
  const issuanceDateTime = credential.sad?.a?.dt || "";
  const credentialStatusRegistry = credential.sad?.ri || "";

  // Determine status
  const statusValue = credential.status?.s;
  const eventType = credential.status?.et;
  const hasRevObject = !!credential.rev;
  const isRevoked = statusValue === "1" || eventType === "rev" || hasRevObject;
  const isIssued = statusValue === "0" && eventType !== "rev" && !hasRevObject;

  // Check expiration (1 year default)
  let isExpired = false;
  if (issuanceDateTime) {
    const issuanceDate = new Date(issuanceDateTime);
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    isExpired = issuanceDate < oneYearAgo;
  }

  let status: "issued" | "revoked" | "expired";
  if (isRevoked) {
    status = "revoked";
  } else if (isExpired) {
    status = "expired";
  } else if (isIssued) {
    status = "issued";
  } else {
    status = "revoked"; // Default to revoked if status is unknown
  }

  const isValid = isIssued && !isExpired && !isRevoked;

  return {
    schemaSaid,
    credentialType,
    credentialTitle,
    issueeId,
    issueeAid,
    issuanceDateTime,
    credentialStatusRegistry,
    attributes,
    status,
    isValid,
  };
}

/**
 * Validate a credential's status and expiration
 * @param credential - The credential to validate
 * @param options - Validation options
 * @returns Validation result with status and details
 */
export function validateCredential(
  credential: Credential,
  options?: CredentialValidationOptions,
): CredentialValidationResult {
  const expirationDays = options?.expirationDays || 365;
  const schemaSaid = credential.sad?.s || credential.schema?.$id || "";
  const credentialType =
    credential.schema?.credentialType || credential.schema?.title || "Unknown";

  // Check credential status
  const statusValue = credential.status?.s;
  const eventType = credential.status?.et;
  const hasRevObject = !!credential.rev;
  const isRevoked = statusValue === "1" || eventType === "rev" || hasRevObject;
  const isIssued = statusValue === "0" && eventType !== "rev" && !hasRevObject;

  // Check expiration
  const issuanceDateTime = credential.sad?.a?.dt;
  let isExpired = false;
  let expiresAt: string | undefined;

  if (issuanceDateTime) {
    const issuanceDate = new Date(issuanceDateTime);
    const expirationDate = new Date(
      issuanceDate.getTime() + expirationDays * 24 * 60 * 60 * 1000,
    );
    const now = new Date();
    isExpired = now > expirationDate;
    expiresAt = expirationDate.toISOString();
  }

  // Build validation result
  if (isRevoked) {
    const revokedAt = credential.rev?.dt || credential.status?.dt || "Unknown";

    return {
      isValid: false,
      status: "revoked",
      message: "Credential has been revoked",
      details: {
        revokedAt,
        schemaSaid,
        credentialType,
      },
    };
  }

  if (isExpired) {
    return {
      isValid: false,
      status: "expired",
      message: "Credential has expired",
      details: {
        issuedAt: issuanceDateTime,
        expiresAt,
        schemaSaid,
        credentialType,
      },
    };
  }

  if (isIssued) {
    return {
      isValid: true,
      status: "issued",
      message: "Credential is valid",
      details: {
        issuedAt: issuanceDateTime,
        expiresAt,
        schemaSaid,
        credentialType,
      },
    };
  }

  return {
    isValid: false,
    status: "unknown",
    message: "Unknown credential status",
    details: {
      schemaSaid,
      credentialType,
    },
  };
}

/**
 * Find a credential by schema SAID from an array of credentials
 * @param credentials - Array of credentials to search
 * @param schemaSaid - The schema SAID to find
 * @returns The matching credential or undefined if not found
 */
export function findCredentialBySchema(
  credentials: Credential[],
  schemaSaid: string,
): Credential | undefined {
  return credentials.find((cred) => {
    const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
    return credSchemaSaid === schemaSaid;
  });
}
