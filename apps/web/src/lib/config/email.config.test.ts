import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

function captureEnv(): EnvSnapshot {
  return {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    POSTMARK_FROM_EMAIL: process.env.POSTMARK_FROM_EMAIL,
    POSTMARK_FROM_NAME: process.env.POSTMARK_FROM_NAME,
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

describe("emailConfig", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("uses a titled support sender by default", async () => {
    delete process.env.POSTMARK_FROM_EMAIL;
    delete process.env.POSTMARK_FROM_NAME;

    const { emailConfig, getPostmarkFromHeader } =
      await import("./email.config");

    expect(emailConfig.postmarkFromAddress).toBe("support@masumi.network");
    expect(emailConfig.postmarkFromName).toBe("Masumi");
    expect(emailConfig.postmarkFromHeader).toBe(
      "Masumi <support@masumi.network>",
    );
    expect(getPostmarkFromHeader("verification")).toBe(
      "Masumi Verification <support@masumi.network>",
    );
  });

  it("normalizes no-reply senders to a support inbox on the same domain", async () => {
    process.env.POSTMARK_FROM_EMAIL = "No Reply <noreply@example.com>";
    delete process.env.POSTMARK_FROM_NAME;

    const { emailConfig, getPostmarkFromHeader } =
      await import("./email.config");

    expect(emailConfig.postmarkFromAddress).toBe("support@example.com");
    expect(emailConfig.postmarkFromName).toBe("Masumi");
    expect(emailConfig.postmarkFromHeader).toBe("Masumi <support@example.com>");
    expect(getPostmarkFromHeader("agentMessenger")).toBe(
      "Masumi Agent Messenger <support@example.com>",
    );
  });

  it("lets POSTMARK_FROM_NAME override the display name", async () => {
    process.env.POSTMARK_FROM_EMAIL = "team@example.com";
    process.env.POSTMARK_FROM_NAME = "Masumi Support";

    const { emailConfig, getPostmarkFromHeader } =
      await import("./email.config");

    expect(emailConfig.postmarkFromAddress).toBe("team@example.com");
    expect(emailConfig.postmarkFromName).toBe("Masumi Support");
    expect(emailConfig.postmarkFromHeader).toBe(
      "Masumi Support <team@example.com>",
    );
    expect(getPostmarkFromHeader("passwordReset")).toBe(
      "Masumi Support Password Reset <team@example.com>",
    );
  });
});
