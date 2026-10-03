import { describe, expect, it } from "vitest";

import { resourceUrlDuplicateKey } from "./resource-url-duplicate-key";

describe("resourceUrlDuplicateKey", () => {
  it("treats trailing-slash variants as the same key", () => {
    const a = resourceUrlDuplicateKey("https://x402.org/protected");
    const b = resourceUrlDuplicateKey("https://x402.org/protected/");
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it("normalizes default ports and casing in host", () => {
    const a = resourceUrlDuplicateKey("HTTPS://X402.ORG/protected");
    const b = resourceUrlDuplicateKey("https://x402.org/protected");
    expect(a).toBe(b);
  });
});
