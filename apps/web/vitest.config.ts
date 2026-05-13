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
  },
});
