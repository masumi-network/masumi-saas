import "dotenv/config";
import type { PrismaConfig } from "prisma/config";
import { env } from "prisma/config";

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/masumi_saas",
  },
} satisfies PrismaConfig;

