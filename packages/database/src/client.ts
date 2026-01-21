import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please check your .env file.",
  );
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma =
  globalForPrisma.prisma ||
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

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
