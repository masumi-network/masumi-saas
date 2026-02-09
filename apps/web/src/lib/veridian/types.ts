/**
 * Type definitions for Veridian credential server integration
 */

/**
 * Raw credential structure from the credential server
 */
export interface Credential {
  sad: {
    s: string; // Schema SAID
    i: string; // Issuer AID
    a: {
      i: string; // Issuee AID
      dt: string; // Issuance date
      [key: string]: unknown; // Other attributes
    };
    ri: string; // Credential status registry
  };
  schema?: {
    $id: string;
    credentialType?: string;
    title?: string;
    version?: string;
  };
  status: {
    s: "0" | "1"; // 0 = issued, 1 = revoked
    et?: string; // Event type
    dt?: string; // Date/time
  };
  rev?: {
    s: string;
    dt: string;
  };
}

/**
 * Formatted credential for API responses
 */
export interface FormattedCredential {
  schemaSaid: string;
  credentialType: string;
  credentialTitle: string;
  issueeId: string;
  issueeAid: string;
  issuanceDateTime: string;
  credentialStatusRegistry: string;
  attributes: Record<string, unknown>;
  status: "issued" | "revoked" | "expired";
  isValid: boolean;
}

/**
 * Credential validation result
 */
export interface CredentialValidationResult {
  isValid: boolean;
  status: "issued" | "revoked" | "expired" | "unknown";
  message: string;
  details?: {
    issuedAt?: string;
    revokedAt?: string;
    expiresAt?: string;
    schemaSaid?: string;
    credentialType?: string;
  };
}

/**
 * Options for credential validation
 */
export interface CredentialValidationOptions {
  expirationDays?: number; // Default: 365 (1 year)
}

/**
 * Credential server API response structure
 */
export interface CredentialServerResponse {
  data: Credential[];
}
