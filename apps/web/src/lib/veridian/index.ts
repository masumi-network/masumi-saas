/**
 * Veridian credential server integration
 * Server-only functions for fetching, validating, and formatting credentials
 */

// Client functions
export {
  fetchContactCredentials,
  getAgentVerificationSchemaSaid,
  getCredentialServerUrl,
  getIssuerOobi,
  issueCredential,
  requestDisclosure,
  resolveOobi,
} from "./client";

// Utility functions
export {
  extractCredentialAttributes,
  findCredentialBySchema,
  formatCredential,
  validateCredential,
} from "./utils";

// Types
export type {
  Credential,
  CredentialServerResponse,
  CredentialValidationOptions,
  CredentialValidationResult,
  FormattedCredential,
} from "./types";
