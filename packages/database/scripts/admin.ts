#!/usr/bin/env tsx
/**
 * Admin CLI — Manage admin users from the command line.
 *
 * Usage:
 *   pnpm admin:promote <email> [<email2> ...]   Promote user(s) to admin
 *   pnpm admin:demote  <email> [<email2> ...]   Demote admin(s) to user
 *   pnpm admin:list                              List all admin users
 *
 * The script updates the `role` field in the database (the same field
 * Better Auth's admin plugin reads) and keeps ADMIN_USER_IDS in
 * apps/web/.env in sync.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { createConsoleLogger, demote, list, promote } from "./admin-lib.js";

// Load .env from apps/web (where DATABASE_URL lives) and fall back to package root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../../apps/web/.env");
const LOCAL_ENV_PATH = path.resolve(__dirname, "../.env");

loadEnv({ path: ENV_PATH });
loadEnv({ path: LOCAL_ENV_PATH });

// ── Helpers ──────────────────────────────────────────────────────────────

const logger = createConsoleLogger();

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    logger.error(
      "DATABASE_URL is not set. Make sure your .env file is configured.",
    );
    process.exit(1);
  }
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

// ── CLI Entry Point ──────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "promote": {
    if (args.length === 0) {
      logger.error("Usage: pnpm admin:promote <email> [<email2> ...]");
      process.exit(1);
    }
    const prisma = createPrismaClient();
    try {
      logger.log(
        `\n${COLORS.bold}Promoting ${args.length} user(s) to admin...${COLORS.reset}\n`,
      );
      await promote(prisma, args, ENV_PATH, logger);
    } finally {
      await prisma.$disconnect();
    }
    break;
  }

  case "demote": {
    if (args.length === 0) {
      logger.error("Usage: pnpm admin:demote <email> [<email2> ...]");
      process.exit(1);
    }
    const prisma = createPrismaClient();
    try {
      logger.log(
        `\n${COLORS.bold}Demoting ${args.length} user(s) to regular user...${COLORS.reset}\n`,
      );
      await demote(prisma, args, ENV_PATH, logger);
    } finally {
      await prisma.$disconnect();
    }
    break;
  }

  case "list": {
    const prisma = createPrismaClient();
    try {
      logger.log(`\n${COLORS.bold}Admin Users${COLORS.reset}\n`);
      await list(prisma, logger);
    } finally {
      await prisma.$disconnect();
    }
    break;
  }

  default:
    console.log(`
${COLORS.bold}Admin CLI${COLORS.reset} — Manage admin users

${COLORS.bold}Commands:${COLORS.reset}
  ${COLORS.cyan}promote${COLORS.reset} <email> [...]   Promote user(s) to admin
  ${COLORS.cyan}demote${COLORS.reset}  <email> [...]   Demote admin(s) to regular user
  ${COLORS.cyan}list${COLORS.reset}                     List all admin users

${COLORS.bold}Examples:${COLORS.reset}
  pnpm admin:promote admin@masumi.network
  pnpm admin:promote admin@masumi.network max@masumi.network
  pnpm admin:demote  admin@masumi.network
  pnpm admin:list
`);
    if (command) {
      logger.error(`Unknown command: ${command}`);
      process.exit(1);
    }
    break;
}
