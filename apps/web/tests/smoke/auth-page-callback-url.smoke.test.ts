import { describe, expect, it } from "vitest";

import {
  buildAuthPageHref,
  resolveAuthPageCallbackUrl,
} from "../../src/lib/auth/auth-page-callback-url";

describe("SMOKE — auth page callback URL resolution", () => {
  it("preserves an explicit callbackUrl query param", () => {
    expect(
      resolveAuthPageCallbackUrl({
        callbackUrl:
          "/api/auth/oauth2/authorize?client_id=masumi-spacetime-web",
      }),
    ).toBe("/api/auth/oauth2/authorize?client_id=masumi-spacetime-web");
  });

  it("reconstructs Better Auth OIDC login prompts into an authorize continuation", () => {
    expect(
      resolveAuthPageCallbackUrl({
        response_type: "code",
        client_id: "masumi-spacetime-web",
        redirect_uri: "http://localhost:5174/auth/callback",
        scope: "openid profile email offline_access",
        state: "state-123",
        nonce: "nonce-123",
        code_challenge: "challenge-123",
        code_challenge_method: "S256",
      }),
    ).toBe(
      "/api/auth/oauth2/authorize?response_type=code&client_id=masumi-spacetime-web&redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&state=state-123&nonce=nonce-123&code_challenge=challenge-123&code_challenge_method=S256",
    );
  });

  it("reconstructs Better Auth OIDC login prompts from the signed cookie payload when the page already has OIDC continuation hints", () => {
    const cookiePayload = encodeURIComponent(
      JSON.stringify({
        response_type: "code",
        client_id: "masumi-spacetime-web",
        redirect_uri: "http://localhost:5174/auth/callback",
        scope: "openid profile email offline_access",
        state: "state-456",
        nonce: "nonce-456",
        code_challenge: "challenge-456",
        code_challenge_method: "S256",
        prompt: "consent",
      }),
    );

    expect(
      resolveAuthPageCallbackUrl(
        {
          client_id: "masumi-spacetime-web",
          code: "resume-code",
          state: "resume-state",
        },
        `${cookiePayload}.signature`,
      ),
    ).toBe(
      "/api/auth/oauth2/authorize?response_type=code&client_id=masumi-spacetime-web&redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&state=state-456&nonce=nonce-456&code_challenge=challenge-456&code_challenge_method=S256&prompt=consent",
    );
  });

  it("ignores the OIDC cookie for a plain sign-in page in another tab", () => {
    const cookiePayload = encodeURIComponent(
      JSON.stringify({
        response_type: "code",
        client_id: "masumi-spacetime-web",
        redirect_uri: "http://localhost:5174/auth/callback",
        scope: "openid profile email offline_access",
        state: "state-789",
        nonce: "nonce-789",
        code_challenge: "challenge-789",
        code_challenge_method: "S256",
        prompt: "consent",
      }),
    );

    expect(resolveAuthPageCallbackUrl({}, `${cookiePayload}.signature`)).toBe(
      undefined,
    );
  });

  it("returns undefined for non-auth queries", () => {
    expect(resolveAuthPageCallbackUrl({ foo: "bar" })).toBeUndefined();
  });

  it("drops broken OIDC authorize callback URLs with error params", () => {
    expect(
      resolveAuthPageCallbackUrl({
        callbackUrl:
          "/api/auth/oauth2/authorize?error=invalid_client&error_description=client_id%20is%20required",
      }),
    ).toBeUndefined();
  });

  it("ignores the OIDC cookie when the current auth page is already in an error state", () => {
    const cookiePayload = encodeURIComponent(
      JSON.stringify({
        response_type: "code",
        client_id: "masumi-spacetime-web",
        redirect_uri: "http://localhost:5174/auth/callback",
        scope: "openid profile email offline_access",
        state: "state-error",
        nonce: "nonce-error",
        code_challenge: "challenge-error",
        code_challenge_method: "S256",
        prompt: "consent",
      }),
    );

    expect(
      resolveAuthPageCallbackUrl(
        {
          error: "invalid_client",
          error_description: "client_id is required",
          client_id: "masumi-spacetime-web",
          state: "resume-state",
        },
        `${cookiePayload}.signature`,
      ),
    ).toBeUndefined();
  });

  it("preserves callbackUrl when linking between auth pages", () => {
    expect(
      buildAuthPageHref(
        "/signup",
        "/api/auth/oauth2/authorize?client_id=masumi-spacetime-web",
      ),
    ).toBe(
      "/signup?callbackUrl=%2Fapi%2Fauth%2Foauth2%2Fauthorize%3Fclient_id%3Dmasumi-spacetime-web",
    );
  });
});
