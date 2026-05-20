import { describe, expect, it } from "vitest";

import { hasApiV1DotSegmentTraversal } from "./proxy";

describe("proxy traversal guard", () => {
  it("blocks encoded dot-segment traversal under /api/v1", () => {
    expect(
      hasApiV1DotSegmentTraversal(
        "https://saas.example.com/api/v1/%2e%2e/auth/get-session",
      ),
    ).toBe(true);
    expect(
      hasApiV1DotSegmentTraversal(
        "https://saas.example.com/api/v1%2f%2e%2e/auth/get-session",
      ),
    ).toBe(true);
    expect(
      hasApiV1DotSegmentTraversal(
        "https://saas.example.com/api/v1%2F..%2Fauth/get-session",
      ),
    ).toBe(true);
  });

  it("allows normal /api/v1 requests and non-api dot paths", () => {
    expect(
      hasApiV1DotSegmentTraversal(
        "https://saas.example.com/api/v1/agents?status=VERIFIED",
      ),
    ).toBe(false);
    expect(
      hasApiV1DotSegmentTraversal(
        "https://saas.example.com/.well-known/openid-configuration",
      ),
    ).toBe(false);
  });
});
