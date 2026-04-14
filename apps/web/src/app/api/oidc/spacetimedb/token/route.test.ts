import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeAuthForOidcTokenSetMock = vi.fn();
const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/config/oidc.config", () => ({
  getTrustedOidcOrigins: () => ["https://web.example.com"],
  oidcEnvConfig: {
    issuer: "https://issuer.example.com",
  },
}));

vi.mock("@/lib/auth/oidc-flow", async () => {
  return {
    OIDC_NO_STORE_HEADERS: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
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
    createSessionForwardedAuthHeaders: (request: Request) => {
      const headers = new Headers({
        Accept: "application/json",
      });

      for (const key of [
        "cookie",
        "origin",
        "referer",
        "sec-fetch-dest",
        "sec-fetch-mode",
        "sec-fetch-site",
        "user-agent",
      ]) {
        const value = request.headers.get(key);
        if (value) {
          headers.set(key, value);
        }
      }

      if (!headers.has("sec-fetch-mode")) {
        headers.set("sec-fetch-mode", "cors");
      }

      return headers;
    },
    exchangeAuthForOidcTokenSet: exchangeAuthForOidcTokenSetMock,
  };
});

describe("/api/oidc/spacetimedb/token", () => {
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    exchangeAuthForOidcTokenSetMock.mockResolvedValue({
      clientId: "masumi-spacetime-web",
      issuer: "https://issuer.example.com",
      token: {
        access_token: "access-token",
        id_token: "id-token",
        refresh_token: "refresh-token",
      },
    });
  });

  it("rejects API key callers with a session-only error", async () => {
    getAuthenticatedOrThrowMock.mockResolvedValue({
      authMethod: "apiKey",
      user: { id: "user-1", emailVerified: true },
    });

    const request = new NextRequest(
      "https://saas.example.com/api/oidc/spacetimedb/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://web.example.com",
        },
        body: JSON.stringify({ client: "web" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "access_denied",
      error_description: "browser_session_required",
    });
    expect(exchangeAuthForOidcTokenSetMock).not.toHaveBeenCalled();
  });

  it("rejects OIDC bearer callers with a session-only error", async () => {
    getAuthenticatedOrThrowMock.mockResolvedValue({
      authMethod: "oidcAccessToken",
      user: { id: "user-1", emailVerified: true },
    });

    const request = new NextRequest(
      "https://saas.example.com/api/oidc/spacetimedb/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://web.example.com",
        },
        body: JSON.stringify({ client: "web" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "access_denied",
      error_description: "browser_session_required",
    });
    expect(exchangeAuthForOidcTokenSetMock).not.toHaveBeenCalled();
  });

  it("forwards only browser-session headers during token exchange", async () => {
    getAuthenticatedOrThrowMock.mockResolvedValue({
      authMethod: "session",
      user: { id: "user-1", emailVerified: true },
    });

    const request = new NextRequest(
      "https://saas.example.com/api/oidc/spacetimedb/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://web.example.com",
          Cookie: "better-auth.session_token=session-cookie",
          Authorization: "Bearer should-not-forward",
          "x-api-key": "masumi_should_not_forward",
          Referer: "https://web.example.com/app",
        },
        body: JSON.stringify({ client: "web" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    const [exchangeArgs] = exchangeAuthForOidcTokenSetMock.mock.calls[0] ?? [];
    const authHeaders = exchangeArgs?.authHeaders as Headers;

    expect(authHeaders.get("cookie")).toBe(
      "better-auth.session_token=session-cookie",
    );
    expect(authHeaders.get("origin")).toBe("https://web.example.com");
    expect(authHeaders.get("referer")).toBe("https://web.example.com/app");
    expect(authHeaders.get("authorization")).toBeNull();
    expect(authHeaders.get("x-api-key")).toBeNull();
  });
});
