import { describe, expect, it } from "vitest";

import { createEmptyBrowserRedirectResponse } from "./redirect-response";

describe("createEmptyBrowserRedirectResponse", () => {
  it("preserves redirect metadata while dropping JSON body headers", async () => {
    const response = new Response(JSON.stringify({ redirect: true }), {
      status: 302,
      statusText: "Found",
      headers: {
        "content-length": "17",
        "content-type": "application/json",
        location: "/signin",
        "set-cookie": "session=abc; Path=/; HttpOnly",
        "x-content-type-options": "nosniff",
      },
    });

    const redirect = createEmptyBrowserRedirectResponse(response);

    expect(redirect.status).toBe(302);
    expect(redirect.statusText).toBe("Found");
    expect(redirect.headers.get("location")).toBe("/signin");
    expect(redirect.headers.get("set-cookie")).toBe(
      "session=abc; Path=/; HttpOnly",
    );
    expect(redirect.headers.get("x-content-type-options")).toBe("nosniff");
    expect(redirect.headers.get("content-type")).toBeNull();
    expect(redirect.headers.get("content-length")).toBe("0");
    expect(await redirect.text()).toBe("");
  });

  it("can override the redirect location", () => {
    const response = Response.redirect("https://example.com/signin", 302);
    const redirect = createEmptyBrowserRedirectResponse(
      response,
      "https://example.com/oidc/consent",
    );

    expect(redirect.headers.get("location")).toBe(
      "https://example.com/oidc/consent",
    );
  });
});
