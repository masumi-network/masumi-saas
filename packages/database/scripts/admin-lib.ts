/**
 * Admin CLI — Core library functions.
 *
 * This module exports the business logic for the admin CLI so it can be
 * tested independently from the CLI entry point.
 */

import fs from "node:fs";

// ── Types ────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role?: string | null;
}

/**
 * Minimal interface for the Prisma operations we need.
 * This allows injecting a mock in tests.
 */
export interface PrismaLike {
  user: {
    findFirst: (args: {
      where: { email: string };
      select: { id: true; email: true; name: true; role: true };
    }) => Promise<AdminUser | null>;
    findMany: (args: {
      where: { role: string };
      select: { id: true; email: true; name: true };
    }) => Promise<AdminUser[]>;
    update: (args: {
      where: { id: string };
      data: { role: string };
    }) => Promise<AdminUser>;
  };
  $disconnect: () => Promise<void>;
}

// ── Output interface (for capturing in tests) ────────────────────────────

export interface Logger {
  log: (msg: string) => void;
  success: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

export function createConsoleLogger(): Logger {
  return {
    log: (msg: string) => console.log(msg),
    success: (msg: string) =>
      console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`),
    warn: (msg: string) =>
      console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`),
    error: (msg: string) =>
      console.error(`${COLORS.red}✗${COLORS.reset} ${msg}`),
  };
}

// ── syncEnvFile ──────────────────────────────────────────────────────────

/**
 * Read current ADMIN_USER_IDS from .env, update it, and write back.
 * Only modifies the ADMIN_USER_IDS line — leaves everything else untouched.
 *
 * @returns true if the file was updated, false if skipped
 */
export function syncEnvFile(
  envPath: string,
  adminIds: string[],
  logger?: Logger,
): boolean {
  if (!fs.existsSync(envPath)) {
    logger?.warn(`.env file not found at ${envPath} — skipping .env sync`);
    return false;
  }

  let content = fs.readFileSync(envPath, "utf-8");
  const newValue = adminIds.join(",");

  if (content.includes("ADMIN_USER_IDS=")) {
    // Replace existing line
    content = content.replace(
      /^ADMIN_USER_IDS=.*$/m,
      `ADMIN_USER_IDS="${newValue}"`,
    );
  } else {
    // Append if not present
    content += `\n# Admin Configuration\nADMIN_USER_IDS="${newValue}"\n`;
  }

  fs.writeFileSync(envPath, content, "utf-8");
  return true;
}

// ── getAllAdminIds ────────────────────────────────────────────────────────

export async function getAllAdminIds(prisma: PrismaLike): Promise<AdminUser[]> {
  return prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, name: true },
  });
}

// ── promote ──────────────────────────────────────────────────────────────

export interface PromoteResult {
  promoted: string[];
  alreadyAdmin: string[];
  notFound: string[];
}

export async function promote(
  prisma: PrismaLike,
  emails: string[],
  envPath: string,
  logger: Logger,
): Promise<PromoteResult> {
  const result: PromoteResult = {
    promoted: [],
    alreadyAdmin: [],
    notFound: [],
  };

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      logger.error(
        `User not found: ${email} — make sure they've signed up first`,
      );
      result.notFound.push(email);
      continue;
    }

    if (user.role === "admin") {
      logger.warn(`${user.email} (${user.name}) is already an admin`);
      result.alreadyAdmin.push(email);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
    });

    logger.success(`${user.email} (${user.name}) → promoted to admin`);
    result.promoted.push(email);
  }

  // Sync .env with all current admin IDs
  const allAdmins = await getAllAdminIds(prisma);
  syncEnvFile(
    envPath,
    allAdmins.map((a) => a.id),
    logger,
  );
  logger.log(`ADMIN_USER_IDS in .env updated (${allAdmins.length} admin(s))`);

  return result;
}

// ── demote ───────────────────────────────────────────────────────────────

export interface DemoteResult {
  demoted: string[];
  alreadyUser: string[];
  notFound: string[];
}

export async function demote(
  prisma: PrismaLike,
  emails: string[],
  envPath: string,
  logger: Logger,
): Promise<DemoteResult> {
  const result: DemoteResult = {
    demoted: [],
    alreadyUser: [],
    notFound: [],
  };

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      logger.error(`User not found: ${email}`);
      result.notFound.push(email);
      continue;
    }

    if (user.role !== "admin") {
      logger.warn(`${user.email} (${user.name}) is already a regular user`);
      result.alreadyUser.push(email);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "user" },
    });

    logger.success(`${user.email} (${user.name}) → demoted to user`);
    result.demoted.push(email);
  }

  // Sync .env with all current admin IDs
  const allAdmins = await getAllAdminIds(prisma);
  syncEnvFile(
    envPath,
    allAdmins.map((a) => a.id),
    logger,
  );
  logger.log(`ADMIN_USER_IDS in .env updated (${allAdmins.length} admin(s))`);

  return result;
}

// ── list ─────────────────────────────────────────────────────────────────

export async function list(
  prisma: PrismaLike,
  logger: Logger,
): Promise<AdminUser[]> {
  const admins = await getAllAdminIds(prisma);

  if (admins.length === 0) {
    logger.warn("No admin users found.");
  } else {
    for (const admin of admins) {
      logger.log(`${admin.email} (${admin.name}) — ${admin.id}`);
    }
    logger.log(`Total: ${admins.length} admin(s)`);
  }

  return admins;
}
