import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authHandlerGet: vi.fn(),
  authHandlerPost: vi.fn(),
  carryForwardOauthAccessTokenOidcSessionId: vi.fn(),
  createIdTokenForRefreshToken: vi.fn(),
  exchangeAuthForOidcTokenSet: vi.fn(),
  findDeviceCodeByDeviceCode: vi.fn(),
  getOauthAccessTokenOidcSessionIdForRefreshToken: vi.fn(),
  getSessionForHeaders: vi.fn(),
  handleMasumiAuthorizationCodeGrant: vi.fn(),
  handleMasumiOidcAuthorizeRequest: vi.fn(),
  logOidcScopeResolution: vi.fn(),
  persistApprovedDeviceScopes: vi.fn(),
  resolveOidcClientKey: vi.fn(),
  resolveOidcScopeGrantSet: vi.fn(),
}));

vi.mock("@/lib/auth/auth-storage", () => ({
  carryForwardOauthAccessTokenOidcSessionId:
    mocks.carryForwardOauthAccessTokenOidcSessionId,
  findDeviceCodeByDeviceCode: mocks.findDeviceCodeByDeviceCode,
  getOauthAccessTokenOidcSessionIdForRefreshToken:
    mocks.getOauthAccessTokenOidcSessionIdForRefreshToken,
}));

vi.mock("@/lib/auth/oidc-flow", () => ({
  OidcTokenExchangeError: class OidcTokenExchangeError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly details?: unknown,
    ) {
      super(message);
      this.name = "OidcTokenExchangeError";
    }
  },
  exchangeAuthForOidcTokenSet: mocks.exchangeAuthForOidcTokenSet,
}));

vi.mock("@/lib/auth/oidc-id-token", () => ({
  createIdTokenForRefreshToken: mocks.createIdTokenForRefreshToken,
}));

vi.mock("@/lib/auth/oidc-route-helpers", () => ({
  OIDC_ACCESS_DENIED: "access_denied",
  OIDC_EMAIL_VERIFICATION_REQUIRED: "email_verification_required",
  OIDC_NO_STORE_HEADERS: {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  },
  authHandler: {
    GET: mocks.authHandlerGet,
    POST: mocks.authHandlerPost,
  },
  createJsonRequest: (
    request: Request,
    url: string,
    body: Record<string, string>,
  ) => {
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");

    return new Request(url, {
      method: request.method,
      headers,
      body: JSON.stringify(body),
    });
  },
  getSessionForHeaders: mocks.getSessionForHeaders,
  handleMasumiAuthorizationCodeGrant: mocks.handleMasumiAuthorizationCodeGrant,
  handleMasumiOidcAuthorizeRequest: mocks.handleMasumiOidcAuthorizeRequest,
  hasContentType: (request: Request, value: string) =>
    request.headers.get("content-type")?.includes(value) ?? false,
  logOidcScopeResolution: mocks.logOidcScopeResolution,
  persistApprovedDeviceScopes: mocks.persistApprovedDeviceScopes,
  readBodyFields: async (request: Request) => {
    if (
      request.headers.get("content-type")?.includes("x-www-form-urlencoded")
    ) {
      const formData = await request.clone().formData();
      return Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [
          key,
          typeof value === "string" ? value : value.name,
        ]),
      );
    }

    if (request.headers.get("content-type")?.includes("application/json")) {
      return (await request.clone().json()) as Record<string, string>;
    }

    return null;
  },
}));

vi.mock("@/lib/auth/oidc-user-grants", () => ({
  resolveOidcScopeGrantSet: mocks.resolveOidcScopeGrantSet,
}));

vi.mock("@/lib/config/oidc.config", () => ({
  oidcEnvConfig: {
    cli: {
      clientId: "masumi-spacetime-cli",
    },
  },
  resolveOidcClientKey: mocks.resolveOidcClientKey,
}));

vi.mock("@/lib/config/oidc-scopes.config", () => ({
  OIDC_STANDARD_SCOPES: ["openid", "profile", "email"],
  serializeScopeList: (scopes: string[]) => scopes.join(" "),
}));

describe("/api/auth/oauth2/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the previous OIDC session id before refresh-token rotation", async () => {
    const order: string[] = [];
    mocks.getOauthAccessTokenOidcSessionIdForRefreshToken.mockImplementation(
      async (refreshToken: string) => {
        order.push(`lookup:${refreshToken}`);
        return "stable-sid";
      },
    );
    mocks.authHandlerPost.mockImplementation(async (request: Request) => {
      order.push("rotate");
      const formData = await request.clone().formData();
      expect(formData.get("refresh_token")).toBe("old-refresh-token");

      return Response.json({
        access_token: "rotated-access-token",
        refresh_token: "rotated-refresh-token",
        token_type: "Bearer",
      });
    });
    mocks.carryForwardOauthAccessTokenOidcSessionId.mockImplementation(
      async (options: {
        previousOidcSessionId: string | null;
        rotatedRefreshToken: string;
      }) => {
        order.push("carry");
        expect(options).toEqual({
          previousOidcSessionId: "stable-sid",
          rotatedRefreshToken: "rotated-refresh-token",
        });
        return "stable-sid";
      },
    );
    mocks.createIdTokenForRefreshToken.mockImplementation(
      async (refreshToken: string) => {
        order.push(`id-token:${refreshToken}`);
        return "refreshed-id-token";
      },
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://saas.example.com/api/auth/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: "masumi-spacetime-cli",
          grant_type: "refresh_token",
          refresh_token: "old-refresh-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: "rotated-access-token",
      refresh_token: "rotated-refresh-token",
      id_token: "refreshed-id-token",
    });
    expect(order).toEqual([
      "lookup:old-refresh-token",
      "rotate",
      "carry",
      "id-token:rotated-refresh-token",
    ]);
  });

  it("still mints an id_token when OIDC session carry-forward fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      mocks.getOauthAccessTokenOidcSessionIdForRefreshToken.mockResolvedValue(
        "stable-sid",
      );
      mocks.authHandlerPost.mockResolvedValue(
        Response.json({
          access_token: "rotated-access-token",
          refresh_token: "rotated-refresh-token",
          token_type: "Bearer",
        }),
      );
      mocks.carryForwardOauthAccessTokenOidcSessionId.mockRejectedValue(
        new Error("temporary database failure"),
      );
      mocks.createIdTokenForRefreshToken.mockResolvedValue(
        "refreshed-id-token",
      );

      const { POST } = await import("./route");
      const response = await POST(
        new Request("https://saas.example.com/api/auth/oauth2/token", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: "masumi-spacetime-cli",
            grant_type: "refresh_token",
            refresh_token: "old-refresh-token",
          }),
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        access_token: "rotated-access-token",
        refresh_token: "rotated-refresh-token",
        id_token: "refreshed-id-token",
      });
      expect(mocks.createIdTokenForRefreshToken).toHaveBeenCalledWith(
        "rotated-refresh-token",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[OIDC refresh grant] Failed to carry forward oidcSessionId",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
