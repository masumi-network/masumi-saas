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
// Note: Session, Account, Verification, RateLimit, OauthApplication,
// OauthAccessToken, OauthConsent, DeviceCode, and Jwks are intentionally
// omitted — they are internal Better Auth tables managed exclusively by the
// auth layer.
export type {
  Agent,
  AgentReference,
  Apikey,
  InboxAgentReference,
  Invitation,
  KybSubmission,
  KybVerification,
  KycSubmission,
  KycVerification,
  Member,
  Organization,
  OrgApiKey,
  SupportedPaymentSource,
  User,
  VeridianCredential,
  WalletCache,
  X402EvmWallet,
  X402Network,
  X402PaymentAttempt,
  X402Settlement,
  X402WalletBudget,
} from "./generated/prisma/client.js";

// Prisma namespace (types + runtime helpers such as PrismaClientKnownRequestError).
export { Prisma } from "./generated/prisma/client.js";

// Export enums as values (runtime constants, not just types).
// Use `export type` for types; enums need `export` since they are JS values.
export {
  AgentReferenceStatus,
  CredentialStatus,
  LowBalanceStatus,
  RegistrationState,
  VerificationStatus,
  WalletConnectionState,
  WalletType,
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentScheme,
  X402PaymentStatus,
} from "./generated/prisma/client.js";
