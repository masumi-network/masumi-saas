import { defineConfig } from "vitest/config";

export default defineConfig({
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
