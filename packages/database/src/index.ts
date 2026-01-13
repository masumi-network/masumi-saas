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

// Export types from Prisma client
export type {
  Apikey,
  Invitation,
  Member,
  Organization,
  Prisma,
  User,
} from "./generated/prisma/client.js";
