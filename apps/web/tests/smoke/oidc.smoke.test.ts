import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { BASE_URL, request, requestForm, signUpAndSignIn } from "../helpers";
import prisma from "../prisma-client";

const ISSUER_URL =
  process.env.OIDC_PUBLIC_ISSUER_URL ?? "http://localhost:2999";
const WEB_CLIENT_ID = process.env.OIDC_WEB_CLIENT_ID ?? "masumi-spacetime-web";
const WEB_REDIRECT_URL = (
  process.env.OIDC_WEB_REDIRECT_URLS?.split(",")[0]?.trim() ||
  "http://localhost:3002/auth/callback"
).replace(/\/+$/, "");
const WEB_ORIGIN = new URL(WEB_REDIRECT_URL).origin;

function buildWebAuthorizePath(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: WEB_CLIENT_ID,
    redirect_uri: WEB_REDIRECT_URL,
    scope: "openid profile email offline_access",
    state: "state-123",
    nonce: "nonce-123",
    code_challenge: "challenge-123",
    code_challenge_method: "S256",
  });

  return `/api/auth/oauth2/authorize?${params.toString()}`;
}

function createPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

async function setOidcGrantScopes(
  email: string,
  clientId: string,
  scopes: string[],
) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found for OIDC grant test: ${email}`);
  }

  if (scopes.length === 0) {
    await prisma.oidcUserGrant.deleteMany({
      where: {
        userId: user.id,
        clientId,
      },
    });
    return;
  }

  await prisma.oidcUserGrant.upsert({
    where: {
      userId_clientId: {
        userId: user.id,
        clientId,
      },
    },
    update: {
      scopes,
    },
    create: {
      userId: user.id,
      clientId,
      scopes,
    },
  });
}

async function exchangeWebAuthorizationCodeTokenSet(options: {
  jar: import("../helpers").CookieJar;
  scope: string;
}) {
  const codeVerifier = "oidc-smoke-code-verifier-123456789";
  const codeChallenge = createPkceChallenge(codeVerifier);
  const state = `state-${Date.now()}`;
  const nonce = `nonce-${Date.now()}`;
  const authorizeParams = new URLSearchParams({
    response_type: "code",
    client_id: WEB_CLIENT_ID,
    redirect_uri: WEB_REDIRECT_URL,
    scope: options.scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authorizeRes = await request(
    `/api/auth/oauth2/authorize?${authorizeParams.toString()}`,
    {
      jar: options.jar,
      headers: {
        Accept: "application/json",
        "sec-fetch-mode": "cors",
      },
    },
  );

  expect(authorizeRes.status).toBe(200);
  const authorizeBody = authorizeRes.body as Record<string, unknown>;
  expect(authorizeBody.redirect).toBe(true);
  expect(typeof authorizeBody.url).toBe("string");

  const redirectUrl = new URL(authorizeBody.url as string);
  expect(redirectUrl.searchParams.get("state")).toBe(state);
  const code = redirectUrl.searchParams.get("code");
  expect(code).toBeTruthy();

  const tokenRes = await requestForm("/api/auth/oauth2/token", {
    body: {
      grant_type: "authorization_code",
      client_id: WEB_CLIENT_ID,
      code: code as string,
      redirect_uri: WEB_REDIRECT_URL,
      code_verifier: codeVerifier,
    },
  });

  expect(tokenRes.status).toBe(200);
  return tokenRes.body as Record<string, unknown>;
}

async function markEmailVerified(email: string) {
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });
}

async function createEmailVerificationToken(email: string) {
  const encode = (value: string) => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(
    JSON.stringify({
      email,
      iat: now,
      exp: now + 7 * 24 * 60 * 60,
    }),
  );
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "")
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

function decodeJwtHeader(token: string): Record<string, unknown> {
  const [header] = token.split(".");
  if (!header) {
    throw new Error("JWT header missing");
  }

  return JSON.parse(
    Buffer.from(header, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("JWT payload missing");
  }

  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("SMOKE — OIDC discovery", () => {
  it("GET /.well-known/openid-configuration returns issuer metadata", async () => {
    const res = await request("/.well-known/openid-configuration");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.issuer).toBeDefined();
    expect(body.authorization_endpoint).toBe(
      `${ISSUER_URL}/api/auth/oauth2/authorize`,
    );
    expect(body.token_endpoint).toBe(`${ISSUER_URL}/api/auth/oauth2/token`);
    expect(body.jwks_uri).toBe(`${ISSUER_URL}/jwks`);
    expect(body.id_token_signing_alg_values_supported).toContain("ES256");
  });

  it("GET /.well-known/oauth-authorization-server returns OAuth metadata", async () => {
    const res = await request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.authorization_endpoint).toBe(
      `${ISSUER_URL}/api/auth/oauth2/authorize`,
    );
    expect(body.token_endpoint).toBe(`${ISSUER_URL}/api/auth/oauth2/token`);
    expect(body.scopes_supported).toContain("agents:read:preprod");
    expect(body.scopes_supported).toContain("dashboard:read:mainnet");
  });

  it("GET /jwks returns a JSON web key set", async () => {
    const res = await request("/jwks");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(Array.isArray(body.keys)).toBe(true);

    const [firstKey] = body.keys as Array<Record<string, unknown>>;
    expect(firstKey?.alg).toBe("ES256");
    expect(firstKey?.kty).toBe("EC");
  });

  it("GET /.well-known/oauth-authorization-server advertises the device-code grant", async () => {
    const res = await request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.device_authorization_endpoint).toBe(
      `${ISSUER_URL}/api/auth/device/code`,
    );
    expect(body.token_endpoint).toBe(`${ISSUER_URL}/api/auth/oauth2/token`);
    expect(body.grant_types_supported).toContain(
      "urn:ietf:params:oauth:grant-type:device_code",
    );
  });
});

describe("SMOKE — OIDC Spacetime bridge", () => {
  it("sign-up creates an email verification code record", async () => {
    const { email } = await signUpAndSignIn();
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: `email-verification-otp-${email.toLowerCase()}`,
      },
    });

    expect(verification).not.toBeNull();
    expect(verification?.value).toMatch(/^\d{6}:0$/);
  });

  it("OPTIONS /api/oidc/spacetimedb/token allows configured OIDC web origins", async () => {
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "OPTIONS",
      headers: {
        Origin: WEB_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("POST /api/oidc/spacetimedb/token requires auth", async () => {
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      body: { client: "web" },
      headers: {
        Origin: WEB_ORIGIN,
      },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("POST /api/oidc/spacetimedb/token returns CORS headers on validation failures", async () => {
    const { jar, email } = await signUpAndSignIn();
    await markEmailVerified(email);
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "invalid-client" },
      headers: {
        Origin: WEB_ORIGIN,
      },
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("POST /api/oidc/spacetimedb/token blocks unverified users", async () => {
    const { jar } = await signUpAndSignIn();
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "web" },
      headers: {
        Origin: WEB_ORIGIN,
      },
    });

    expect(res.status).toBe(403);
    const body = res.body as Record<string, unknown>;
    expect(body.error).toBe("access_denied");
    expect(body.error_description).toBe("email_verification_required");
  });

  it("POST /api/oidc/spacetimedb/token exchanges session for OIDC token set", async () => {
    const { jar, email } = await signUpAndSignIn();
    await markEmailVerified(email);
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "web" },
    });

    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.clientId).toBe(WEB_CLIENT_ID);

    const token = body.token as Record<string, unknown>;
    expect(typeof token.access_token).toBe("string");
    expect(typeof token.id_token).toBe("string");
    expect(typeof token.refresh_token).toBe("string");

    const header = decodeJwtHeader(token.id_token as string);
    const payload = decodeJwtPayload(token.id_token as string);
    expect(header.alg).toBe("ES256");
    expect(payload.iss).toBe(ISSUER_URL);
    expect(payload.sub).toBeDefined();
    expect(payload.aud).toBe(WEB_CLIENT_ID);
  });

  it("refresh grant returns a fresh id_token with updated claims", async () => {
    const { jar, email } = await signUpAndSignIn();
    const exchangeRes = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "web" },
    });

    expect(exchangeRes.status).toBe(403);
    await markEmailVerified(email);
    const verifiedExchangeRes = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "web" },
    });

    expect(verifiedExchangeRes.status).toBe(200);
    const exchangeBody = verifiedExchangeRes.body as Record<string, unknown>;
    const token = exchangeBody.token as Record<string, unknown>;
    expect(typeof token.refresh_token).toBe("string");
    expect(typeof token.id_token).toBe("string");

    const initialPayload = decodeJwtPayload(token.id_token as string);
    expect(initialPayload.email_verified).toBe(true);

    await prisma.user.update({
      where: { email },
      data: { emailVerified: false },
    });

    const refreshRes = await requestForm("/api/auth/oauth2/token", {
      body: {
        grant_type: "refresh_token",
        client_id: WEB_CLIENT_ID,
        refresh_token: token.refresh_token as string,
      },
    });

    expect(refreshRes.status).toBe(200);
    const refreshedToken = refreshRes.body as Record<string, unknown>;
    expect(typeof refreshedToken.id_token).toBe("string");

    const refreshedHeader = decodeJwtHeader(refreshedToken.id_token as string);
    const refreshedPayload = decodeJwtPayload(
      refreshedToken.id_token as string,
    );

    expect(refreshedHeader.alg).toBe("ES256");
    expect(refreshedPayload.email_verified).toBe(false);
    expect(refreshedPayload.aud).toBe(WEB_CLIENT_ID);
  });

  it("OIDC consent page shows email verification gate for unverified users", async () => {
    const { jar } = await signUpAndSignIn();
    const res = await request(
      `/oidc/consent?consent_code=test-consent&client_id=${WEB_CLIENT_ID}&scope=${encodeURIComponent("openid profile email offline_access")}`,
      {
        jar,
        headers: {
          Accept: "text/html",
        },
      },
    );

    expect(res.status).toBe(200);
    expect(String(res.body)).toContain("Verify your email to continue");
    expect(String(res.body)).toContain("Switch account");
  });

  it("verify-email link callback preserves the OIDC continuation", async () => {
    const { jar, email } = await signUpAndSignIn();
    const token = await createEmailVerificationToken(email);
    const authorizePath = buildWebAuthorizePath();
    const res = await fetch(
      `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(authorizePath)}`,
      {
        headers: {
          Cookie: jar.header(),
          Origin: BASE_URL,
        },
        redirect: "manual",
      },
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(authorizePath);
  });
});

describe("SMOKE — OIDC API scopes", () => {
  it("authorization_code flow intersects requested scopes with stored grants", async () => {
    const { jar, email } = await signUpAndSignIn();
    await markEmailVerified(email);
    await setOidcGrantScopes(email, WEB_CLIENT_ID, ["agents:read:preprod"]);

    const tokenSet = await exchangeWebAuthorizationCodeTokenSet({
      jar,
      scope:
        "openid profile email offline_access agents:read:preprod agents:write:preprod dashboard:read:mainnet",
    });

    expect(typeof tokenSet.access_token).toBe("string");
    expect(typeof tokenSet.scope).toBe("string");

    const grantedScopes = String(tokenSet.scope).split(" ").filter(Boolean);
    expect(grantedScopes).toContain("openid");
    expect(grantedScopes).toContain("profile");
    expect(grantedScopes).toContain("email");
    expect(grantedScopes).toContain("offline_access");
    expect(grantedScopes).toContain("agents:read:preprod");
    expect(grantedScopes).not.toContain("agents:write:preprod");
    expect(grantedScopes).not.toContain("dashboard:read:mainnet");
  });

  it("OIDC access_token authenticates API calls and enforces network scopes", async () => {
    const { jar, email } = await signUpAndSignIn();
    await markEmailVerified(email);
    await setOidcGrantScopes(email, WEB_CLIENT_ID, ["agents:read:preprod"]);

    const tokenSet = await exchangeWebAuthorizationCodeTokenSet({
      jar,
      scope: "openid profile email offline_access agents:read:preprod",
    });
    const accessToken = tokenSet.access_token as string;
    const idToken = tokenSet.id_token as string;

    const allowedRes = await request("/api/agents/counts?network=Preprod", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(allowedRes.status).toBe(200);

    const deniedNetworkRes = await request(
      "/api/agents/counts?network=Mainnet",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    expect(deniedNetworkRes.status).toBe(403);
    expect((deniedNetworkRes.body as Record<string, unknown>).error).toBe(
      "Missing required scope: agents:read:mainnet",
    );

    const idTokenRes = await request("/api/agents/counts?network=Preprod", {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    expect(idTokenRes.status).toBe(401);
  });
});

describe("SMOKE — OIDC device flow", () => {
  it("POST /api/auth/device/code creates a device authorization request", async () => {
    const res = await requestForm("/api/auth/device/code", {
      body: {
        client_id: "masumi-spacetime-cli",
        scope: "openid profile offline_access",
      },
    });

    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(typeof body.device_code).toBe("string");
    expect(typeof body.user_code).toBe("string");
    expect(body.verification_uri).toBe(`${ISSUER_URL}/device`);
    expect(body.verification_uri_complete).toBe(
      `${ISSUER_URL}/device?user_code=${body.user_code}`,
    );
  });

  it("approved device flow returns an OIDC token set from the standard token endpoint", async () => {
    const deviceRes = await requestForm("/api/auth/device/code", {
      body: {
        client_id: "masumi-spacetime-cli",
        scope: "openid profile offline_access",
      },
    });
    expect(deviceRes.status).toBe(200);

    const deviceBody = deviceRes.body as Record<string, unknown>;
    const userCode = deviceBody.user_code as string;
    const deviceCode = deviceBody.device_code as string;

    const authJar = await signUpAndSignIn();
    await markEmailVerified(authJar.email);
    const approveRes = await request("/api/auth/device/approve", {
      method: "POST",
      jar: authJar.jar,
      body: { userCode },
    });
    expect(approveRes.status).toBe(200);

    const tokenRes = await requestForm("/api/auth/oauth2/token", {
      body: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: "masumi-spacetime-cli",
      },
    });
    expect(tokenRes.status).toBe(200);

    const token = tokenRes.body as Record<string, unknown>;
    expect(typeof token.access_token).toBe("string");
    expect(typeof token.id_token).toBe("string");
    expect(token.token_type).toBe("Bearer");

    const header = decodeJwtHeader(token.id_token as string);
    const payload = decodeJwtPayload(token.id_token as string);
    expect(header.alg).toBe("ES256");
    expect(payload.iss).toBe(ISSUER_URL);
    expect(payload.aud).toBe("masumi-spacetime-cli");
    expect(payload.sub).toBeDefined();
  });

  it("unverified device flow returns email verification required", async () => {
    const deviceRes = await requestForm("/api/auth/device/code", {
      body: {
        client_id: "masumi-spacetime-cli",
        scope: "openid profile offline_access",
      },
    });
    expect(deviceRes.status).toBe(200);

    const deviceBody = deviceRes.body as Record<string, unknown>;
    const authJar = await signUpAndSignIn();
    const approveRes = await request("/api/auth/device/approve", {
      method: "POST",
      jar: authJar.jar,
      body: { userCode: deviceBody.user_code },
    });
    expect(approveRes.status).toBe(200);

    const tokenRes = await requestForm("/api/auth/oauth2/token", {
      body: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceBody.device_code as string,
        client_id: "masumi-spacetime-cli",
      },
    });

    expect(tokenRes.status).toBe(403);
    const token = tokenRes.body as Record<string, unknown>;
    expect(token.error).toBe("access_denied");
    expect(token.error_description).toBe("email_verification_required");
  });

  it("legacy POST /api/auth/device/token still returns an OIDC token set", async () => {
    const deviceRes = await requestForm("/api/auth/device/code", {
      body: {
        client_id: "masumi-spacetime-cli",
        scope: "openid profile offline_access",
      },
    });
    expect(deviceRes.status).toBe(200);

    const deviceBody = deviceRes.body as Record<string, unknown>;
    const authJar = await signUpAndSignIn();
    await markEmailVerified(authJar.email);
    const approveRes = await request("/api/auth/device/approve", {
      method: "POST",
      jar: authJar.jar,
      body: { userCode: deviceBody.user_code },
    });
    expect(approveRes.status).toBe(200);

    const tokenRes = await requestForm("/api/auth/device/token", {
      body: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceBody.device_code as string,
        client_id: "masumi-spacetime-cli",
      },
    });
    expect(tokenRes.status).toBe(200);

    const token = tokenRes.body as Record<string, unknown>;
    expect(typeof token.access_token).toBe("string");
    expect(typeof token.id_token).toBe("string");
  });

  it("denied device flow returns access_denied", async () => {
    const deviceRes = await requestForm("/api/auth/device/code", {
      body: {
        client_id: "masumi-spacetime-cli",
        scope: "openid",
      },
    });
    expect(deviceRes.status).toBe(200);

    const deviceBody = deviceRes.body as Record<string, unknown>;
    const authJar = await signUpAndSignIn();
    const denyRes = await request("/api/auth/device/deny", {
      method: "POST",
      jar: authJar.jar,
      body: { userCode: deviceBody.user_code },
    });
    expect(denyRes.status).toBe(200);

    const tokenRes = await requestForm("/api/auth/oauth2/token", {
      body: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceBody.device_code as string,
        client_id: "masumi-spacetime-cli",
      },
    });
    expect(tokenRes.status).toBe(400);

    const body = tokenRes.body as Record<string, unknown>;
    expect(body.error).toBe("access_denied");
  });
});
