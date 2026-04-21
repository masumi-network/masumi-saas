import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addUserOidcGrantScopes: vi.fn(),
  createEmptyBrowserRedirectResponse: vi.fn(),
  createIdTokenForAccessTokenRecord: vi.fn(),
  createOidcSessionId: vi.fn(),
  createStoredOauthAccessToken: vi.fn(),
  findDeviceCodeByUserCode: vi.fn(),
  findVerificationByIdentifier: vi.fn(),
  resolveOidcClientKey: vi.fn(),
  resolveOidcScopeGrantSet: vi.fn(),
  toNextJsHandler: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  verification: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("@masumi/database/client", () => ({
  default: prismaMock,
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: mocks.toNextJsHandler,
}));

vi.mock("../config/oidc.config", () => ({
  getTrustedOidcClients: () => [
    {
      clientId: "masumi-spacetime-web",
      disabled: false,
      redirectUrls: ["https://web.example.com/auth/callback"],
      type: "public",
    },
  ],
  oidcEnvConfig: {
    issuer: "https://issuer.example.com",
  },
  resolveOidcClientKey: mocks.resolveOidcClientKey,
}));

vi.mock("../config/oidc-scopes.config", () => ({
  OIDC_STANDARD_SCOPES: ["openid", "profile", "email"],
  serializeScopeList: (scopes: string[]) => scopes.join(" "),
}));

vi.mock("./auth", () => ({
  auth: {},
}));

vi.mock("./auth-storage", () => ({
  createOidcSessionId: mocks.createOidcSessionId,
  createStoredOauthAccessToken: mocks.createStoredOauthAccessToken,
  findDeviceCodeByUserCode: mocks.findDeviceCodeByUserCode,
  findVerificationByIdentifier: mocks.findVerificationByIdentifier,
}));

vi.mock("./callback-url", () => ({
  buildAbsoluteAppUrl: (path: string) => `https://app.example.com${path}`,
}));

vi.mock("./oidc-id-token", () => ({
  createIdTokenForAccessTokenRecord: mocks.createIdTokenForAccessTokenRecord,
}));

vi.mock("./oidc-user-grants", () => ({
  addUserOidcGrantScopes: mocks.addUserOidcGrantScopes,
  resolveOidcScopeGrantSet: mocks.resolveOidcScopeGrantSet,
}));

vi.mock("./redirect-response", () => ({
  createEmptyBrowserRedirectResponse: mocks.createEmptyBrowserRedirectResponse,
}));

function createPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

describe("handleMasumiAuthorizationCodeGrant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toNextJsHandler.mockReturnValue({
      GET: vi.fn(),
      POST: vi.fn(),
    });
  });

  it("rejects banned users before issuing OIDC tokens", async () => {
    const codeVerifier = "test-code-verifier-123456789";
    mocks.findVerificationByIdentifier.mockResolvedValue({
      id: "verification-1",
      expiresAt: new Date(Date.now() + 60_000),
      value: JSON.stringify({
        authTime: 1234567890,
        clientId: "masumi-spacetime-web",
        codeChallenge: createPkceChallenge(codeVerifier),
        codeChallengeMethod: "S256",
        nonce: "nonce-1",
        redirectURI: "https://web.example.com/auth/callback",
        scope: "openid profile email offline_access",
        userId: "user-1",
      }),
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      banned: true,
      email: "banned@example.com",
      emailVerified: true,
      name: "Banned User",
      image: null,
      updatedAt: new Date(),
    });

    const { handleMasumiAuthorizationCodeGrant } =
      await import("./oidc-route-helpers");
    const response = await handleMasumiAuthorizationCodeGrant(
      new Request("https://saas.example.com/api/auth/oauth2/token", {
        method: "POST",
      }),
      {
        client_id: "masumi-spacetime-web",
        code: "authorization-code",
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: "https://web.example.com/auth/callback",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "access_denied",
      error_description: "user_banned",
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        banned: true,
        email: true,
        emailVerified: true,
        name: true,
        image: true,
        updatedAt: true,
      },
    });
    expect(prismaMock.verification.deleteMany).not.toHaveBeenCalled();
    expect(mocks.resolveOidcScopeGrantSet).not.toHaveBeenCalled();
    expect(mocks.createStoredOauthAccessToken).not.toHaveBeenCalled();
    expect(mocks.createIdTokenForAccessTokenRecord).not.toHaveBeenCalled();
  });
});
