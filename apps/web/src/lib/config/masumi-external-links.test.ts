import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_DISCORD_INVITE_URL,
  DEFAULT_IMPRINT_PAGE_URL,
  DEFAULT_SUPPORT_PAGE_URL,
  LEGACY_LEGAL_PAGE_URL,
  LEGACY_SUPPORT_PAGE_URL,
} from "./masumi-external-links";

const __dirname = dirname(fileURLToPath(import.meta.url));

function captureEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_IMPRINT_PAGE_URL: process.env.NEXT_PUBLIC_IMPRINT_PAGE_URL,
    NEXT_PUBLIC_SUPPORT_PAGE_URL: process.env.NEXT_PUBLIC_SUPPORT_PAGE_URL,
    NEXT_PUBLIC_DISCORD_INVITE_URL: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL,
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

describe("masumi-external-links", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("defaults to canonical Masumi imprint and support pages", async () => {
    delete process.env.NEXT_PUBLIC_IMPRINT_PAGE_URL;
    delete process.env.NEXT_PUBLIC_SUPPORT_PAGE_URL;
    delete process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

    const { DISCORD_INVITE_URL, IMPRINT_PAGE_URL, SUPPORT_PAGE_URL } =
      await import("./masumi-external-links");

    expect(IMPRINT_PAGE_URL).toBe(DEFAULT_IMPRINT_PAGE_URL);
    expect(SUPPORT_PAGE_URL).toBe(DEFAULT_SUPPORT_PAGE_URL);
    expect(DISCORD_INVITE_URL).toBe(DEFAULT_DISCORD_INVITE_URL);
    expect(IMPRINT_PAGE_URL).not.toBe(LEGACY_LEGAL_PAGE_URL);
    expect(SUPPORT_PAGE_URL).not.toBe(LEGACY_SUPPORT_PAGE_URL);
  });

  it("allows overriding via NEXT_PUBLIC env vars", async () => {
    process.env.NEXT_PUBLIC_IMPRINT_PAGE_URL = "https://example.com/imprint";
    process.env.NEXT_PUBLIC_SUPPORT_PAGE_URL = "https://example.com/support";
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL =
      "https://discord.com/invite/example";

    const { DISCORD_INVITE_URL, IMPRINT_PAGE_URL, SUPPORT_PAGE_URL } =
      await import("./masumi-external-links");

    expect(IMPRINT_PAGE_URL).toBe("https://example.com/imprint");
    expect(SUPPORT_PAGE_URL).toBe("https://example.com/support");
    expect(DISCORD_INVITE_URL).toBe("https://discord.com/invite/example");
  });
});

describe("masumi external link consumers", () => {
  const consumerPaths = [
    join(__dirname, "../../components/footer.tsx"),
    join(__dirname, "../../components/auth-footer.tsx"),
    join(__dirname, "../../components/header.tsx"),
    join(__dirname, "../../components/error-boundary-actions.tsx"),
    join(__dirname, "../../app/(app)/components/header-client.tsx"),
    join(
      __dirname,
      "../../app/(app)/components/user-avatar/user-avatar.client.tsx",
    ),
    join(__dirname, "../../app/(app)/components/search-dialog.tsx"),
    join(
      __dirname,
      "../../app/(app)/ai-agents/components/request-verification-dialog.tsx",
    ),
    join(__dirname, "../../app/(app)/verification/components/sumsub-step.tsx"),
    join(__dirname, "../email/masumi-email-layout.tsx"),
    join(__dirname, "../email/agent-messenger-email-layout.tsx"),
  ];

  it("does not hardcode dead legal or legacy support URLs", () => {
    for (const path of consumerPaths) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain(LEGACY_LEGAL_PAGE_URL);
      expect(source).not.toContain(LEGACY_SUPPORT_PAGE_URL);
    }
  });

  it("routes imprint and support links through shared config", () => {
    for (const path of consumerPaths) {
      expect(readFileSync(path, "utf8")).toContain("masumi-external-links");
    }
  });

  it("does not label imprint links as legal in footers or search", () => {
    const imprintConsumerPaths = [
      join(__dirname, "../../components/footer.tsx"),
      join(__dirname, "../../components/auth-footer.tsx"),
      join(__dirname, "../../app/(app)/components/search-dialog.tsx"),
    ];

    for (const path of imprintConsumerPaths) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("IMPRINT_PAGE_URL");
      expect(source).not.toContain('t("legal")');
      expect(source).not.toContain("LEGAL_PAGE_URL");
    }
  });
});
