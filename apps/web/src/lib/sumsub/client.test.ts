import crypto from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

function captureEnv(): EnvSnapshot {
  return {
    SUMSUB_APP_TOKEN: process.env.SUMSUB_APP_TOKEN,
    SUMSUB_SECRET_KEY: process.env.SUMSUB_SECRET_KEY,
  };
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("verifySumsubWebhookSignature", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("accepts a valid hexadecimal signature and normalizes case", async () => {
    process.env.SUMSUB_SECRET_KEY = "sumsub-secret";
    process.env.SUMSUB_APP_TOKEN = "sumsub-app";
    const { verifySumsubWebhookSignature } = await import("./client");

    const payload = JSON.stringify({ type: "applicantWorkflowCompleted" });
    const timestamp = "1713000000";
    const signature = crypto
      .createHmac("sha256", "sumsub-secret")
      .update(`${timestamp}${payload}`)
      .digest("hex")
      .toUpperCase();

    expect(verifySumsubWebhookSignature(payload, signature, timestamp)).toBe(
      true,
    );
  });

  it("returns false for malformed signatures instead of throwing", async () => {
    process.env.SUMSUB_SECRET_KEY = "sumsub-secret";
    process.env.SUMSUB_APP_TOKEN = "sumsub-app";
    const { verifySumsubWebhookSignature } = await import("./client");

    expect(
      verifySumsubWebhookSignature("{}", "not-a-hex-signature", "1713000000"),
    ).toBe(false);
    expect(verifySumsubWebhookSignature("{}", "abc", "1713000000")).toBe(false);
  });
});
