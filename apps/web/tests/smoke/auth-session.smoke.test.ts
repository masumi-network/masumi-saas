import { describe, expect, it } from "vitest";

import { CookieJar, request, TEST_SIGNUP_PASSWORD } from "../helpers";

describe("SMOKE: email sign-up session", () => {
  // better-auth 1.7 creates the user and session inside an adapter
  // transaction. If the transaction-scoped adapter skips token hashing, the
  // cookie token never matches the stored row and get-session returns null.
  it("sign-up returns a session cookie that get-session resolves", async () => {
    const jar = new CookieJar();
    const email = `session-smoke-${Date.now()}@example.com`;

    const signUpRes = await request("/api/auth/sign-up/email", {
      method: "POST",
      jar,
      body: { name: "Session Smoke", email, password: TEST_SIGNUP_PASSWORD },
    });
    expect(signUpRes.status).toBe(200);

    const sessionRes = await request("/api/auth/get-session", { jar });
    expect(sessionRes.status).toBe(200);
    const body = sessionRes.body as {
      user?: { email?: string };
      session?: { token?: string };
    } | null;
    expect(body?.user?.email).toBe(email);
  });
});
