import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PRIVACY_POLICY_URL,
  LEGACY_PRIVACY_POLICY_URL,
} from "./privacy-policy-url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function captureEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_PRIVACY_POLICY_URL: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL,
  };
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("privacy-policy-url", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("defaults to the Masumi privacy page", async () => {
    delete process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL;

    const { PRIVACY_POLICY_URL } = await import("./privacy-policy-url");

    expect(PRIVACY_POLICY_URL).toBe(DEFAULT_PRIVACY_POLICY_URL);
    expect(PRIVACY_POLICY_URL).not.toBe(LEGACY_PRIVACY_POLICY_URL);
  });

  it("allows overriding via NEXT_PUBLIC_PRIVACY_POLICY_URL", async () => {
    process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL =
      "https://example.com/custom-privacy";

    const { PRIVACY_POLICY_URL } = await import("./privacy-policy-url");

    expect(PRIVACY_POLICY_URL).toBe("https://example.com/custom-privacy");
  });
});

describe("privacy policy link consumers", () => {
  const consumerPaths = [
    join(__dirname, "../../components/footer.tsx"),
    join(__dirname, "../../components/auth-footer.tsx"),
    join(__dirname, "../../components/cookie-consent.tsx"),
    join(__dirname, "../../app/(app)/components/search-dialog.tsx"),
    join(
      __dirname,
      "../../app/(auth)/signup/components/signup-password-form.tsx",
    ),
    join(
      __dirname,
      "../../app/(auth)/signup/components/signup-magic-link-form.tsx",
    ),
  ];

  it("does not hardcode the legacy House of Communication privacy URL", () => {
    for (const path of consumerPaths) {
      expect(readFileSync(path, "utf8")).not.toContain(
        LEGACY_PRIVACY_POLICY_URL,
      );
    }
  });

  it("routes privacy links through the shared config", () => {
    for (const path of consumerPaths) {
      expect(readFileSync(path, "utf8")).toContain("privacy-policy-url");
    }
  });
});
