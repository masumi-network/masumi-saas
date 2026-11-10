import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { BASE_URL, request, requestForm, signUpAndSignIn } from "../helpers";
import prisma from "../prisma-client";

const CLI_CLIENT_ID = process.env.OIDC_CLI_CLIENT_ID ?? "masumi-spacetime-cli";
const CLI_REDIRECT_URL =
  process.env.OIDC_CLI_REDIRECT_URLS?.split(",")[0]?.trim() ||
  "http://127.0.0.1:43110/callback";
const API_SCOPE = "agents:read:preprod";
const SESSION_COOKIE_PATTERN = /session_token=([^;]+)/;

function cliAuthorizeParams(scope: string): URLSearchParams {
  return new URLSearchParams({
    response_type: "code",
    client_id: CLI_CLIENT_ID,
    redirect_uri: CLI_REDIRECT_URL,
    scope,
    state: "state-policy",
    code_challenge: createHash("sha256")
      .update("verifier-policy-smoke-0123456789abcdef0123456789")
      .digest("base64url"),
    code_challenge_method: "S256",
  });
}

async function markEmailVerified(email: string) {
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
}

describe("SMOKE: OIDC authorize policy", () => {
  // The provider reads a POST to /oauth2/authorize from the form body. The
  // policy hook must filter that body too, or an unverified user gets a code.
  it("POST authorize applies the email gate like GET", async () => {
    const { jar } = await signUpAndSignIn();
    const res = await fetch(`${BASE_URL}/api/auth/oauth2/authorize`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: BASE_URL,
        Cookie: jar.header(),
      },
      body: cliAuthorizeParams(`openid ${API_SCOPE}`).toString(),
    });

    const outcome = `${res.headers.get("location") ?? ""} ${await res.text()}`;
    expect(outcome).not.toContain("code=");
    expect(outcome).toContain("email_verification_required");
  });

  // Signed out, the user is unknown, so stored grants cannot be checked yet.
  // The scope carried to sign-in must keep the requested API scope.
  it("signed-out CLI authorize keeps API scopes for the resumed run", async () => {
    const params = cliAuthorizeParams(`openid ${API_SCOPE}`);
    const res = await fetch(
      `${BASE_URL}/api/auth/oauth2/authorize?${params.toString()}`,
      { redirect: "manual" },
    );

    // A fetch caller gets the sign-in URL as JSON; a browser gets a redirect.
    const target =
      res.headers.get("location") ??
      ((await res.json()) as { url?: string }).url ??
      "";
    const location = new URL(target, BASE_URL);
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("scope")?.split(" ")).toContain(API_SCOPE);
  });
});

describe("SMOKE: OIDC session bridge identity", () => {
  // A bearer header for another user must not change whose session the
  // bridge checks: the tokens are minted from the cookie alone.
  it("checks the cookie user even when a bearer token names another user", async () => {
    const { jar: unverifiedJar } = await signUpAndSignIn({
      email: `bridge-unverified-${Date.now()}@example.com`,
    });
    const verifiedEmail = `bridge-verified-${Date.now()}@example.com`;
    const { jar: verifiedJar } = await signUpAndSignIn({
      email: verifiedEmail,
    });
    await markEmailVerified(verifiedEmail);
    const verifiedToken = SESSION_COOKIE_PATTERN.exec(
      verifiedJar.header(),
    )?.[1];
    expect(verifiedToken).toBeTruthy();

    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar: unverifiedJar,
      body: { client: "web" },
      headers: {
        Authorization: `Bearer ${decodeURIComponent(verifiedToken ?? "")}`,
      },
    });

    expect(res.status).toBe(403);
    expect((res.body as Record<string, unknown>).error_description).toBe(
      "email_verification_required",
    );
  });
});

describe("SMOKE: OIDC token grant for banned users", () => {
  // A refresh token outlives a ban, so the token endpoint must check it.
  it("refresh grant is refused after the user is banned", async () => {
    const { jar, email } = await signUpAndSignIn({
      email: `banned-refresh-${Date.now()}@example.com`,
    });
    await markEmailVerified(email);
    const exchange = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "web" },
    });
    expect(exchange.status).toBe(200);
    const exchangeBody = exchange.body as {
      clientId: string;
      token: { refresh_token: string };
    };

    await prisma.user.update({ where: { email }, data: { banned: true } });
    const refresh = await requestForm("/api/auth/oauth2/token", {
      body: {
        grant_type: "refresh_token",
        client_id: exchangeBody.clientId,
        refresh_token: exchangeBody.token.refresh_token,
      },
    });

    expect(refresh.status).toBe(403);
    expect((refresh.body as Record<string, unknown>).error_description).toBe(
      "user_banned",
    );
  });
});

describe("SMOKE: OIDC consent submit origin", () => {
  it("rejects a consent submit from another origin", async () => {
    const res = await fetch(`${BASE_URL}/oidc/consent/submit`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      },
      body: new URLSearchParams({ oauth_query: "a=b", accept: "true" }),
    });

    expect(res.status).toBe(403);
  });
});

describe("SMOKE: OIDC JWT access tokens on the app API", () => {
  // A `resource` parameter makes the provider issue a stateless JWT access
  // token. Revoking the client cannot end it, so the app API must refuse it.
  it("refuses a JWT access token issued for a resource", async () => {
    const { jar, email } = await signUpAndSignIn({
      email: `jwt-access-${Date.now()}@example.com`,
    });
    await markEmailVerified(email);
    const resource = `${BASE_URL}/api/auth/oauth2/userinfo`;
    const codeVerifier = "jwt-access-smoke-verifier-0123456789abcdef0123";
    const authorizeParams = new URLSearchParams({
      response_type: "code",
      client_id: CLI_CLIENT_ID,
      redirect_uri: CLI_REDIRECT_URL,
      scope: "openid",
      state: "state-jwt",
      resource,
      code_challenge: createHash("sha256")
        .update(codeVerifier)
        .digest("base64url"),
      code_challenge_method: "S256",
    });
    const authorize = await request(
      `/api/auth/oauth2/authorize?${authorizeParams.toString()}`,
      {
        jar,
        headers: { Accept: "application/json", "sec-fetch-mode": "cors" },
      },
    );
    expect(authorize.status).toBe(200);
    const code = new URL(
      (authorize.body as { url: string }).url,
    ).searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await requestForm("/api/auth/oauth2/token", {
      body: {
        grant_type: "authorization_code",
        client_id: CLI_CLIENT_ID,
        code: code ?? "",
        redirect_uri: CLI_REDIRECT_URL,
        code_verifier: codeVerifier,
        resource,
      },
    });
    expect(token.status).toBe(200);
    const accessToken = (token.body as { access_token: string }).access_token;
    expect(accessToken.split(".")).toHaveLength(3);

    const api = await request("/api/v1/inbox-agents?network=Preprod", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(api.status).toBe(401);
  });
});
