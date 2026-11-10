import { describe, expect, it } from "vitest";

import {
  buildAuthorizeUrlFromSignedQuery,
  extractSignedOAuthQuery,
} from "./signed-query";

const SIGNED =
  "client_id=web&scope=openid+profile&exp=1&ba_iat=2&ba_param=ba_iat&ba_param=ba_param&ba_param=client_id&ba_param=exp&ba_param=scope&sig=abc";

describe("extractSignedOAuthQuery", () => {
  it("drops params the app appended after signing", () => {
    const params = new URLSearchParams(`${SIGNED}&error=boom`);
    const extracted = new URLSearchParams(
      extractSignedOAuthQuery(params) ?? "",
    );
    expect(extracted.has("error")).toBe(false);
    expect(extracted.get("sig")).toBe("abc");
    expect(extracted.get("scope")).toBe("openid profile");
    expect(extracted.getAll("ba_param")).toHaveLength(5);
  });

  it("returns null for an unsigned query", () => {
    expect(
      extractSignedOAuthQuery(new URLSearchParams("client_id=web")),
    ).toBeNull();
    expect(
      extractSignedOAuthQuery(new URLSearchParams("client_id=web&sig=abc")),
    ).toBeNull();
  });
});

describe("buildAuthorizeUrlFromSignedQuery", () => {
  it("keeps the OAuth params and strips the signature params", () => {
    const url = new URL(
      buildAuthorizeUrlFromSignedQuery(SIGNED),
      "http://localhost",
    );
    expect(url.pathname).toBe("/api/auth/oauth2/authorize");
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "scope"]);
  });
});
