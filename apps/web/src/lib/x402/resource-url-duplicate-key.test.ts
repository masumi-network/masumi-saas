import { describe, expect, it } from "vitest";

import {
  canonicalX402ResourceUrl,
  resourceUrlDuplicateKey,
} from "./resource-url-duplicate-key";

describe("resourceUrlDuplicateKey", () => {
  it("preserves trailing-slash resource identity", () => {
    const a = resourceUrlDuplicateKey("https://x402.org/protected");
    const b = resourceUrlDuplicateKey("https://x402.org/protected/");
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("normalizes default ports and casing in host", () => {
    const a = resourceUrlDuplicateKey("HTTPS://X402.ORG/protected");
    const b = resourceUrlDuplicateKey("https://x402.org/protected");
    expect(a).toBe(b);
  });
});

it("preserves the supplied trailing slash for the probe", () => {
  expect(canonicalX402ResourceUrl("https://example.com/paid/")).toBe(
    "https://example.com/paid/",
  );
});
it("preserves case in paths and query values", () => {
  expect(resourceUrlDuplicateKey("https://example.com/paid/A")).not.toBe(
    resourceUrlDuplicateKey("https://example.com/paid/a"),
  );
  expect(resourceUrlDuplicateKey("https://example.com/paid?id=A")).not.toBe(
    resourceUrlDuplicateKey("https://example.com/paid?id=a"),
  );
});
