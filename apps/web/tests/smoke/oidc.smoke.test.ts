import { describe, expect, it } from "vitest";

import { request, requestForm, signUpAndSignIn } from "../helpers";

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
      "http://localhost:2999/api/auth/oauth2/authorize",
    );
    expect(body.token_endpoint).toBe(
      "http://localhost:2999/api/auth/oauth2/token",
    );
    expect(body.jwks_uri).toBe("http://localhost:2999/jwks");
  });

  it("GET /.well-known/oauth-authorization-server returns OAuth metadata", async () => {
    const res = await request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.authorization_endpoint).toBe(
      "http://localhost:2999/api/auth/oauth2/authorize",
    );
    expect(body.token_endpoint).toBe(
      "http://localhost:2999/api/auth/oauth2/token",
    );
  });

  it("GET /jwks returns a JSON web key set", async () => {
    const res = await request("/jwks");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(Array.isArray(body.keys)).toBe(true);
  });

  it("GET /.well-known/oauth-authorization-server advertises the device-code grant", async () => {
    const res = await request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.device_authorization_endpoint).toBe(
      "http://localhost:2999/api/auth/device/code",
    );
    expect(body.token_endpoint).toBe(
      "http://localhost:2999/api/auth/oauth2/token",
    );
    expect(body.grant_types_supported).toContain(
      "urn:ietf:params:oauth:grant-type:device_code",
    );
  });
});

describe("SMOKE — OIDC Spacetime bridge", () => {
  it("OPTIONS /api/oidc/spacetimedb/token allows configured OIDC web origins", async () => {
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3002",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3002",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("POST /api/oidc/spacetimedb/token requires auth", async () => {
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      body: { client: "web" },
      headers: {
        Origin: "http://localhost:3002",
      },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3002",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("POST /api/oidc/spacetimedb/token returns CORS headers on validation failures", async () => {
    const { jar } = await signUpAndSignIn();
    const res = await request("/api/oidc/spacetimedb/token", {
      method: "POST",
      jar,
      body: { client: "invalid-client" },
      headers: {
        Origin: "http://localhost:3002",
      },
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3002",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
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
    expect(payload.iss).toBe("http://localhost:2999");
    expect(payload.sub).toBeDefined();
    expect(payload.aud).toBe("masumi-spacetime-web");
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
    expect(body.verification_uri).toBe("http://localhost:2999/device");
    expect(body.verification_uri_complete).toBe(
      `http://localhost:2999/device?user_code=${body.user_code}`,
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

    const payload = decodeJwtPayload(token.id_token as string);
    expect(payload.iss).toBe("http://localhost:2999");
    expect(payload.aud).toBe("masumi-spacetime-cli");
    expect(payload.sub).toBeDefined();
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
