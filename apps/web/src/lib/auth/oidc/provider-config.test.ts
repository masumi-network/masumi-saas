import { describe, expect, it } from "vitest";

import { buildOidcIdTokenClaims } from "./provider-config";

const user = {
  email: "ada@example.com",
  emailVerified: true,
  name: "Ada King Lovelace",
  image: "https://example.com/ada.png",
  updatedAt: new Date("2026-01-02T03:04:05.000Z"),
};

describe("buildOidcIdTokenClaims", () => {
  it("splits the display name into given and family names", () => {
    expect(buildOidcIdTokenClaims(user, ["openid", "profile"])).toEqual({
      name: "Ada King Lovelace",
      given_name: "Ada",
      family_name: "King Lovelace",
      picture: "https://example.com/ada.png",
      profile: "https://example.com/ada.png",
      updated_at: "2026-01-02T03:04:05.000Z",
    });
  });

  it("falls back to the email when the user has no name", () => {
    const claims = buildOidcIdTokenClaims(
      { ...user, name: "  ", image: null },
      ["profile"],
    );
    expect(claims.name).toBe("ada@example.com");
    expect(claims.given_name).toBe("ada@example.com");
    expect(claims).not.toHaveProperty("family_name");
    expect(claims).not.toHaveProperty("picture");
  });

  it("adds email claims only for the email scope", () => {
    expect(buildOidcIdTokenClaims(user, ["openid"])).toEqual({});
    expect(buildOidcIdTokenClaims(user, ["email"])).toEqual({
      email: "ada@example.com",
      email_verified: true,
    });
  });
});
