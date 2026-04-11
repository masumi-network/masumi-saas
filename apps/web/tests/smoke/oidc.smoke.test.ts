import { describe, expect, it } from "vitest";

import { request, signUpAndSignIn } from "../helpers";

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
      "http://localhost:3000/api/auth/oauth2/authorize",
    );
    expect(body.token_endpoint).toBe(
      "http://localhost:3000/api/auth/oauth2/token",
    );
    expect(body.jwks_uri).toBe("http://localhost:3000/jwks");
  });

  it("GET /.well-known/oauth-authorization-server returns OAuth metadata", async () => {
    const res = await request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.authorization_endpoint).toBe(
      "http://localhost:3000/api/auth/oauth2/authorize",
    );
    expect(body.token_endpoint).toBe(
      "http://localhost:3000/api/auth/oauth2/token",
    );
  });

  it("GET /jwks returns a JSON web key set", async () => {
    const res = await request("/jwks");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(Array.isArray(body.keys)).toBe(true);
  });
});

describe("SMOKE — OIDC Spacetime bridge", () => {
  it("POST /api/oidc/spacetimedb/token requires auth", async () => {
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      body: { client: "web" },
    });

    expect(res.status).toBe(401);
  });

  it("POST /api/oidc/spacetimedb/token exchanges session for OIDC token set", async () => {
    const { jar } = await signUpAndSignIn();
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "web" },
    });

    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.clientId).toBe("masumi-spacetime-web");

    const token = body.token as Record<string, unknown>;
    expect(typeof token.access_token).toBe("string");
    expect(typeof token.id_token).toBe("string");

    const payload = decodeJwtPayload(token.id_token as string);
    expect(payload.iss).toBe("http://localhost:3000");
    expect(payload.sub).toBeDefined();
    expect(payload.aud).toBe("masumi-spacetime-web");
  });
});
