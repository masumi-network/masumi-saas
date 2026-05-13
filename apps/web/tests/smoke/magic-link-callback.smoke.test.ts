import { describe, expect, it } from "vitest";

import {
  buildMagicLinkCallbackUrl,
  decodeMagicLinkContinuation,
  isOidcMagicLinkCallbackUrl,
} from "../../src/lib/auth/magic-link-callback";

describe("SMOKE — magic-link callback wrapping", () => {
  it("wraps OIDC authorize callbacks through the magic-link continue route", () => {
    const authorizePath =
      "/api/auth/oauth2/authorize?response_type=code&client_id=masumi-spacetime-web&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&state=test-state&nonce=test-nonce&code_challenge=test-challenge&code_challenge_method=S256&prompt=consent";

    const wrapped = buildMagicLinkCallbackUrl(authorizePath);

    expect(
      wrapped.startsWith("http://localhost:2999/magic-link/continue?flow="),
    ).toBe(true);

    const parsed = new URL(wrapped);
    expect(
      decodeMagicLinkContinuation(parsed.searchParams.get("flow") ?? undefined),
    ).toBe(authorizePath);
    expect(isOidcMagicLinkCallbackUrl(wrapped)).toBe(true);
  });

  it("keeps non-OIDC callbacks unchanged", () => {
    expect(buildMagicLinkCallbackUrl("/dashboard")).toBe(
      "http://localhost:2999/dashboard",
    );
    expect(isOidcMagicLinkCallbackUrl("/dashboard")).toBe(false);
  });
});
