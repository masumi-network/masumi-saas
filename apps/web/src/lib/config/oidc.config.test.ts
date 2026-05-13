import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

function captureEnv(): EnvSnapshot {
  return {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    OIDC_PUBLIC_ISSUER_URL: process.env.OIDC_PUBLIC_ISSUER_URL,
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

describe("getPublicOidcMetadata", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("does not advertise unsigned ID tokens", async () => {
    process.env.BETTER_AUTH_URL = "https://saas.example.com";
    const { OIDC_ID_TOKEN_SIGNING_ALG, getPublicOidcMetadata } =
      await import("./oidc.config");

    expect(
      getPublicOidcMetadata().id_token_signing_alg_values_supported,
    ).toEqual([OIDC_ID_TOKEN_SIGNING_ALG]);
  });

  it("advertises token and session identifier claims", async () => {
    process.env.BETTER_AUTH_URL = "https://saas.example.com";
    const { getPublicOidcMetadata } = await import("./oidc.config");

    expect(getPublicOidcMetadata().claims_supported).toEqual(
      expect.arrayContaining(["jti", "sid"]),
    );
  });
});
