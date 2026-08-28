import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, RegistrationState } from "./generated/prisma/client.js";

export { RegistrationState };

type PrismaGlobal = {
  prisma?: PrismaClient;
  prismaClientToken?: string;
};

const globalForPrisma = global as unknown as PrismaGlobal;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please check your .env file.",
  );
}

function getPrismaClientToken(): string {
  const generatedClientPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "generated/prisma/client.js",
  );
  try {
    return String(statSync(generatedClientPath).mtimeMs);
  } catch {
    return "unknown";
  }
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prismaClientToken = getPrismaClientToken();

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma != null &&
  globalForPrisma.prismaClientToken !== prismaClientToken
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : [],
  });

// Test connection on startup in development
if (process.env.NODE_ENV === "development") {
  prisma.$connect().catch((error) => {
    console.error("Database connection error:", error.message);
    console.error(
      "Please check:\n1. DATABASE_URL is set in apps/web/.env\n2. PostgreSQL is running\n3. Database exists",
    );
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClientToken = prismaClientToken;
}

export default prisma;
