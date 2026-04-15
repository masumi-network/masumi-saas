import { describe, expect, it } from "vitest";

import { buildSwitchAccountSignInHref } from "./switch-account";

describe("buildSwitchAccountSignInHref", () => {
  it("preserves OIDC authorize continuations", () => {
    const authorizePath =
      "/api/auth/oauth2/authorize?response_type=code&client_id=masumi-spacetime-web&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&state=test-state&nonce=test-nonce&code_challenge=test-challenge&code_challenge_method=S256&prompt=consent";

    expect(buildSwitchAccountSignInHref(authorizePath)).toBe(
      `/signin?callbackUrl=${encodeURIComponent(authorizePath)}`,
    );
  });

  it("preserves same-origin consent page callbacks", () => {
    const consentPath =
      "/oidc/consent?consent_code=test-consent&client_id=masumi-spacetime-web&scope=openid+profile+email";

    expect(buildSwitchAccountSignInHref(consentPath)).toBe(
      `/signin?callbackUrl=${encodeURIComponent(consentPath)}`,
    );
  });

  it("falls back to the app root for unsafe callbacks", () => {
    expect(
      buildSwitchAccountSignInHref("https://malicious.example.com/steal"),
    ).toBe("/signin?callbackUrl=%2F");
  });
});
