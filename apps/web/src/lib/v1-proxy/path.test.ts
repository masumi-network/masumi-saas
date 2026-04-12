import { describe, expect, it } from "vitest";

import {
  hasUnsafeEncodedProxyPath,
  normalizeProxyPathSegments,
  normalizeProxyPathname,
} from "./path";

describe("v1 proxy path normalization", () => {
  it("normalizes valid segments", () => {
    expect(
      normalizeProxyPathSegments(["registry-entry", "nested"]),
    ).toStrictEqual({
      ok: true,
      normalizedPath: "registry-entry/nested",
    });
  });

  it("rejects forbidden traversal segments", () => {
    expect(normalizeProxyPathSegments([".."]).ok).toBe(false);
    expect(normalizeProxyPathSegments(["."]).ok).toBe(false);
  });

  it("rejects encoded slash smuggling", () => {
    expect(normalizeProxyPathSegments(["registry%2fentry"]).ok).toBe(false);
  });

  it("normalizes /api/v1 paths and rejects invalid ones", () => {
    expect(normalizeProxyPathname("/api/v1/registry-entry")).toStrictEqual({
      ok: true,
      normalizedPath: "registry-entry",
    });
    expect(normalizeProxyPathname("/api/v1/../auth/get-session").ok).toBe(
      false,
    );
  });

  it("flags encoded traversal attempts in raw URLs", () => {
    expect(
      hasUnsafeEncodedProxyPath(
        "https://example.com/api/v1/%2e%2e/auth/get-session",
      ),
    ).toBe(true);
    expect(
      hasUnsafeEncodedProxyPath(
        "https://example.com/api/v1/registry-entry?network=Preprod",
      ),
    ).toBe(false);
  });
});
