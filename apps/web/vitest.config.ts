import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 90_000,
    hookTimeout: 30_000,
    reporters: ["verbose"],
    sequence: { concurrent: false },
    fileParallelism: false,
    env: {
      // Route modules transitively import the Prisma client, which throws at
      // import time when DATABASE_URL is missing. Tests stub the database
      // client itself, but the env check fires before mocks resolve.
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test",
    },
  },
});
