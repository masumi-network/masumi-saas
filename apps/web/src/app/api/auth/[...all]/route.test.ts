import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: {} }));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({ GET: mocks.get, POST: mocks.post }),
}));

import { GET, POST } from "./route";

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

function formRequest(path: string, fields: Record<string, string>) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("/api/auth/[...all]", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.post.mockResolvedValue(new Response("{}"));
  });

  it("forwards a legacy device_code poll to /oauth2/token with the same body", async () => {
    await POST(
      formRequest("/api/auth/device/token", {
        grant_type: DEVICE_CODE_GRANT,
        device_code: "dc",
        client_id: "cli",
      }),
    );

    const forwarded = mocks.post.mock.calls[0][0] as Request;
    expect(new URL(forwarded.url).pathname).toBe("/api/auth/oauth2/token");
    const body = new URLSearchParams(await forwarded.text());
    expect(body.get("grant_type")).toBe(DEVICE_CODE_GRANT);
    expect(body.get("device_code")).toBe("dc");
  });

  it("leaves other POSTs on their own path", async () => {
    const request = formRequest("/api/auth/device/token", {
      grant_type: "refresh_token",
    });
    await POST(request);
    expect(mocks.post.mock.calls[0][0]).toBe(request);
  });

  it("strips the body from GET redirects", async () => {
    mocks.get.mockResolvedValue(
      new Response("redirecting", {
        status: 302,
        headers: { location: "http://localhost:3000/signin" },
      }),
    );
    const response = await GET(
      new Request("http://localhost:3000/api/auth/oauth2/authorize"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/signin",
    );
    expect(await response.text()).toBe("");
  });
});
