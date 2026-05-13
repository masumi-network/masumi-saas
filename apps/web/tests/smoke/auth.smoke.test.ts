import { describe, expect, it } from "vitest";

import { findVerificationByIdentifier } from "../../src/lib/auth/auth-storage";
import { CookieJar, request, signIn } from "../helpers";

describe("SMOKE — Auth", () => {
  it("registers via public email route → 202 + accepted payload", async () => {
    const email = `register-${Date.now()}@example.com`;
    const res = await request("/api/register/email", {
      method: "POST",
      body: {
        name: "Smoke Test",
        email,
        termsAccepted: true,
        callbackUrl: "/",
      },
    });

    expect(res.status).toBe(202);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    expect(b.resultKey).toBe("MagicLinkSent");
    expect(b.email).toBe(email);

    const otpRecord = await findVerificationByIdentifier(
      `sign-in-otp-${email.toLowerCase()}`,
      {
        value: true,
      },
    );
    expect(otpRecord).not.toBeNull();
    expect(otpRecord?.value).toMatch(/^[a-f0-9]{64}:0$/);
  });

  it("rejects registration via public email route when terms are missing → 400", async () => {
    const res = await request("/api/register/email", {
      method: "POST",
      body: {
        name: "Smoke Test",
        email: `register-missing-terms-${Date.now()}@example.com`,
        termsAccepted: false,
      },
    });

    expect(res.status).toBe(400);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(false);
  });

  it("signs in with valid credentials → 200 + user object", async () => {
    const jar = new CookieJar();
    const res = await request("/api/auth/sign-in/email", {
      method: "POST",
      jar,
      body: { email: "admin@masumi.network", password: "Admin@12345" },
    });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.user).toBeDefined();
    const user = b.user as Record<string, unknown>;
    expect(user.email).toBe("admin@masumi.network");
    expect(user.role).toBe("admin");
    // cookie must be set
    expect(jar.header()).toContain("better-auth");
  });

  it("rejects wrong password → 401", async () => {
    const res = await request("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: "admin@masumi.network", password: "wrongpassword" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects missing email → non-200", async () => {
    const res = await request("/api/auth/sign-in/email", {
      method: "POST",
      body: { password: "Admin@12345" },
    });
    expect(res.status).not.toBe(200);
  });

  it("rejects unknown email → 401", async () => {
    const res = await request("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: "nobody@nowhere.com", password: "Admin@12345" },
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/get-session returns session for authenticated user", async () => {
    const jar = await signIn();
    const res = await request("/api/auth/get-session", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.user).toBeDefined();
  });

  it("GET /api/auth/get-session returns null body for unauthenticated user (not error)", async () => {
    const res = await request("/api/auth/get-session");
    // Better Auth returns 200 with null body when no session
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
