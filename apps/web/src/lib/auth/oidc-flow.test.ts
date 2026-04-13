import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

const ENV_KEYS = [
  "BETTER_AUTH_URL",
  "OIDC_PUBLIC_ISSUER_URL",
  "OIDC_CLI_REDIRECT_URLS",
  "OIDC_CLI_CLIENT_ID",
] as const;

function captureEnv(): EnvSnapshot {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("exchangeAuthForOidcTokenSet", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exchanges tokens through the in-process authorize and token helpers", async () => {
    process.env.BETTER_AUTH_URL = "https://public.example.com";
    process.env.OIDC_PUBLIC_ISSUER_URL = "https://issuer.example.com";
    process.env.OIDC_CLI_REDIRECT_URLS = "http://127.0.0.1:43110/callback";
    process.env.OIDC_CLI_CLIENT_ID = "masumi-spacetime-cli";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const authorizeMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe("/api/auth/oauth2/authorize");
      expect(request.method).toBe("GET");
      expect(request.headers.get("authorization")).toBe("Bearer session-token");
      expect(request.headers.get("sec-fetch-mode")).toBe("cors");
      expect(url.searchParams.get("client_id")).toBe("masumi-spacetime-cli");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://127.0.0.1:43110/callback",
      );
      expect(url.searchParams.get("scope")).toBe("openid profile email");
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");

      const state = url.searchParams.get("state");
      return Response.json({
        url: `http://127.0.0.1:43110/callback?code=test-code&state=${state}`,
      });
    });

    const tokenMock = vi.fn(
      async (request: Request, body: Record<string, string>) => {
        const url = new URL(request.url);
        expect(url.pathname).toBe("/api/auth/oauth2/token");
        expect(request.method).toBe("POST");
        expect(body).toMatchObject({
          grant_type: "authorization_code",
          client_id: "masumi-spacetime-cli",
          code: "test-code",
          redirect_uri: "http://127.0.0.1:43110/callback",
        });
        expect(body.code_verifier).toBeTypeOf("string");
        expect(body.code_verifier.length).toBeGreaterThan(10);

        return Response.json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          id_token: "id-token",
          token_type: "Bearer",
        });
      },
    );

    vi.doMock("./oidc-route-helpers", () => ({
      OAUTH_AUTHORIZE_PATH: "/api/auth/oauth2/authorize",
      OIDC_NO_STORE_HEADERS: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
      handleMasumiOidcAuthorizeRequest: authorizeMock,
      handleMasumiAuthorizationCodeGrant: tokenMock,
    }));

    const { exchangeAuthForOidcTokenSet } = await import("./oidc-flow");

    const exchange = await exchangeAuthForOidcTokenSet({
      requestUrl: "https://internal-host:2999/api/auth/oauth2/token",
      clientKey: "cli",
      authHeaders: new Headers({
        Authorization: "Bearer session-token",
        "sec-fetch-mode": "cors",
      }),
      scopes: ["openid", "profile", "email"],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(authorizeMock).toHaveBeenCalledOnce();
    expect(tokenMock).toHaveBeenCalledOnce();
    expect(exchange).toEqual({
      issuer: "https://issuer.example.com",
      clientId: "masumi-spacetime-cli",
      token: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        id_token: "id-token",
        token_type: "Bearer",
      },
    });
  });

  it("surfaces unverified-email authorize failures with the existing status and details", async () => {
    process.env.BETTER_AUTH_URL = "https://public.example.com";
    process.env.OIDC_PUBLIC_ISSUER_URL = "https://issuer.example.com";
    process.env.OIDC_CLI_REDIRECT_URLS = "http://127.0.0.1:43110/callback";
    process.env.OIDC_CLI_CLIENT_ID = "masumi-spacetime-cli";

    vi.doMock("./oidc-route-helpers", () => ({
      OAUTH_AUTHORIZE_PATH: "/api/auth/oauth2/authorize",
      OIDC_NO_STORE_HEADERS: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
      handleMasumiOidcAuthorizeRequest: vi.fn(async () =>
        Response.json(
          {
            error: "access_denied",
            error_description: "email_verification_required",
          },
          { status: 403 },
        ),
      ),
      handleMasumiAuthorizationCodeGrant: vi.fn(),
    }));

    const { exchangeAuthForOidcTokenSet } = await import("./oidc-flow");

    await expect(
      exchangeAuthForOidcTokenSet({
        requestUrl: "https://internal-host:2999/api/auth/oauth2/token",
        clientKey: "cli",
        authHeaders: new Headers({
          Authorization: "Bearer session-token",
          "sec-fetch-mode": "cors",
        }),
        scopes: ["openid", "profile", "email"],
      }),
    ).rejects.toMatchObject({
      name: "OidcTokenExchangeError",
      message: "OIDC authorize step failed",
      status: 403,
      details: {
        error: "access_denied",
        error_description: "email_verification_required",
      },
    });
  });

  it("rejects authorize responses that return a mismatched state", async () => {
    process.env.BETTER_AUTH_URL = "https://public.example.com";
    process.env.OIDC_PUBLIC_ISSUER_URL = "https://issuer.example.com";
    process.env.OIDC_CLI_REDIRECT_URLS = "http://127.0.0.1:43110/callback";
    process.env.OIDC_CLI_CLIENT_ID = "masumi-spacetime-cli";

    vi.doMock("./oidc-route-helpers", () => ({
      OAUTH_AUTHORIZE_PATH: "/api/auth/oauth2/authorize",
      OIDC_NO_STORE_HEADERS: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
      handleMasumiOidcAuthorizeRequest: vi.fn(async () =>
        Response.json({
          url: "http://127.0.0.1:43110/callback?code=test-code&state=wrong-state",
        }),
      ),
      handleMasumiAuthorizationCodeGrant: vi.fn(),
    }));

    const { exchangeAuthForOidcTokenSet } = await import("./oidc-flow");

    await expect(
      exchangeAuthForOidcTokenSet({
        requestUrl: "https://internal-host:2999/api/auth/oauth2/token",
        clientKey: "cli",
        authHeaders: new Headers({
          Authorization: "Bearer session-token",
          "sec-fetch-mode": "cors",
        }),
        scopes: ["openid", "profile", "email"],
      }),
    ).rejects.toMatchObject({
      name: "OidcTokenExchangeError",
      message: "OIDC authorize step returned invalid code or state",
      status: 502,
    });
  });

  it("propagates token endpoint failures from the in-process auth-code exchange", async () => {
    process.env.BETTER_AUTH_URL = "https://public.example.com";
    process.env.OIDC_PUBLIC_ISSUER_URL = "https://issuer.example.com";
    process.env.OIDC_CLI_REDIRECT_URLS = "http://127.0.0.1:43110/callback";
    process.env.OIDC_CLI_CLIENT_ID = "masumi-spacetime-cli";

    vi.doMock("./oidc-route-helpers", () => ({
      OAUTH_AUTHORIZE_PATH: "/api/auth/oauth2/authorize",
      OIDC_NO_STORE_HEADERS: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
      handleMasumiOidcAuthorizeRequest: vi.fn(async (request: Request) => {
        const state = new URL(request.url).searchParams.get("state");
        return Response.json({
          url: `http://127.0.0.1:43110/callback?code=test-code&state=${state}`,
        });
      }),
      handleMasumiAuthorizationCodeGrant: vi.fn(async () =>
        Response.json(
          {
            error: "invalid_grant",
            error_description: "code expired",
          },
          { status: 401 },
        ),
      ),
    }));

    const { exchangeAuthForOidcTokenSet } = await import("./oidc-flow");

    await expect(
      exchangeAuthForOidcTokenSet({
        requestUrl: "https://internal-host:2999/api/auth/oauth2/token",
        clientKey: "cli",
        authHeaders: new Headers({
          Authorization: "Bearer session-token",
          "sec-fetch-mode": "cors",
        }),
        scopes: ["openid", "profile", "email"],
      }),
    ).rejects.toMatchObject({
      name: "OidcTokenExchangeError",
      message: "OIDC token exchange failed",
      status: 401,
      details: {
        error: "invalid_grant",
        error_description: "code expired",
      },
    });
  });
});
