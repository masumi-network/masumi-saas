import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const issueSessionTokensMock = vi.fn();
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

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: { masumiIssueOidcSessionTokens: issueSessionTokensMock },
  },
}));

describe("/api/oidc/spacetimedb/token", () => {
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    issueSessionTokensMock.mockResolvedValue({
      clientId: "masumi-spacetime-web",
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
    expect(issueSessionTokensMock).not.toHaveBeenCalled();
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
    expect(issueSessionTokensMock).not.toHaveBeenCalled();
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
    const [issueArgs] = issueSessionTokensMock.mock.calls[0] ?? [];
    const authHeaders = issueArgs?.headers as Headers;
    expect(issueArgs?.body).toEqual({ client: "web" });

    expect(authHeaders.get("cookie")).toBe(
      "better-auth.session_token=session-cookie",
    );
    expect(authHeaders.get("origin")).toBe("https://web.example.com");
    expect(authHeaders.get("referer")).toBe("https://web.example.com/app");
    expect(authHeaders.get("authorization")).toBeNull();
    expect(authHeaders.get("x-api-key")).toBeNull();
  });
});
