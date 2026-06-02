import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

function setEnvValue(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
    return;
  }

  env[key] = value;
}

function captureEnv(): EnvSnapshot {
  return {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
    SUMSUB_BASE_URL: process.env.SUMSUB_BASE_URL,
  };
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    setEnvValue(key, value);
  }
}

describe("next security headers", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("adds hardened defaults plus verification-specific Sumsub allowances", async () => {
    setEnvValue("NODE_ENV", "production");
    setEnvValue(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://public@sentry.example.com/1",
    );
    setEnvValue("SUMSUB_BASE_URL", "https://api.sumsub.com");

    const configModule = await import("./next.config");
    expect(configModule.default.skipProxyUrlNormalize).toBe(true);

    const headers = await configModule.default.headers?.();

    expect(headers).toBeDefined();

    const base = headers?.find((entry) => entry.source === "/:path*");
    const verification = headers?.find(
      (entry) => entry.source === "/verification/:path*",
    );
    const docs = headers?.find((entry) => entry.source === "/docs/:path*");

    expect(base?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Strict-Transport-Security",
        }),
        expect.objectContaining({
          key: "X-Content-Type-Options",
          value: "nosniff",
        }),
        expect.objectContaining({
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        }),
      ]),
    );

    expect(verification?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Content-Security-Policy",
          value: expect.stringContaining("https://api.sumsub.com"),
        }),
      ]),
    );

    expect(docs?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Content-Security-Policy",
          value: expect.stringContaining("frame-ancestors 'self'"),
        }),
      ]),
    );
  });
});
