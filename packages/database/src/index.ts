/**
 * @masumi/database
 *
 * Main entry point for Prisma types, models, and enums.
 * This file exports browser-safe types to avoid Node.js dependencies in client components.
 *
 * ## Usage:
 *
 * ### Import Prisma types and models:
 * ```typescript
 * import { Prisma, User, Organization } from '@masumi/database'
 * ```
 *
 * ### Import the Prisma client singleton:
 * ```typescript
 * import prisma from '@masumi/database/client'
 * ```
 *
 * ### Import repositories:
 * ```typescript
 * import { userRepository, organizationRepository } from '@masumi/database/repositories'
 * ```
 */

// Export model types from Prisma client (browser-safe — no Node.js dependencies).
// Note: Session, Account, Verification, RateLimit are intentionally omitted —
// they are internal Better Auth tables managed exclusively by the auth layer.
export type {
  Agent,
  AgentReference,
  Apikey,
  Invitation,
  KybSubmission,
  KybVerification,
  KycSubmission,
  KycVerification,
  Member,
  Organization,
  OrgApiKey,
  Prisma,
  StripePaymentMethod,
  User,
  VeridianCredential,
  WalletCache,
} from "./generated/prisma/client.js";

// Export enums as values (runtime constants, not just types).
// Use `export type` for types; enums need `export` since they are JS values.
export {
  AgentReferenceStatus,
  CredentialStatus,
  RegistrationState,
  VerificationStatus,
  WalletConnectionState,
  WalletType,
} from "./generated/prisma/client.js";
