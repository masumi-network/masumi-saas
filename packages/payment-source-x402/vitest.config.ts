import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test",
      X402_ENCRYPTION_KEY:
        process.env.X402_ENCRYPTION_KEY ?? "test-x402-encryption-key-32chars!!",
    },
  },
});
