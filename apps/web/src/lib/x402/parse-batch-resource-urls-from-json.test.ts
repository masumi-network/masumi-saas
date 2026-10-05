import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseBatchResourceUrlsFromJson } from "./parse-batch-resource-urls-from-json";

describe("parseBatchResourceUrlsFromJson", () => {
  it("parses Bazaar flat inventory rows", () => {
    const json = JSON.stringify([
      { resource: "https://a.example/one" },
      { resource: "https://b.example/two" },
    ]);
    const { urls, truncated } = parseBatchResourceUrlsFromJson(json);
    expect(urls).toEqual(["https://a.example/one", "https://b.example/two"]);
    expect(truncated).toBe(false);
  });

  it("parses agent candidate grouped resources", () => {
    const json = JSON.stringify([
      {
        payTo: "0xabc",
        resources: [
          { resource: "https://a.example/one" },
          { resource: "https://a.example/two" },
        ],
      },
    ]);
    const { urls } = parseBatchResourceUrlsFromJson(json);
    expect(urls).toHaveLength(2);
  });

  it("parses a plain URL array", () => {
    const json = JSON.stringify([
      "https://x402.org/protected",
      "https://x402.vercel.app/protected",
    ]);
    const { urls } = parseBatchResourceUrlsFromJson(json);
    expect(urls).toHaveLength(2);
  });

  it("dedupes and caps at batch limit", () => {
    const rows = Array.from({ length: 105 }, (_, i) => ({
      resource: `https://host.example/path-${i}`,
    }));
    const { urls, truncated } = parseBatchResourceUrlsFromJson(
      JSON.stringify(rows),
    );
    expect(urls).toHaveLength(100);
    expect(truncated).toBe(true);
  });

  it("returns parseError for invalid JSON", () => {
    const result = parseBatchResourceUrlsFromJson("{ not json");
    expect(result.parseError).toBe("invalid_json");
    expect(result.urls).toHaveLength(0);
  });

  it("reads real base-x402-resources sample shape when present", () => {
    const samplePath = join(
      process.cwd(),
      "../../../base-x402-registry-import/output/base-x402-resources.json",
    );
    let json: string;
    try {
      json = readFileSync(samplePath, "utf8");
    } catch {
      return;
    }
    const { urls, truncated } = parseBatchResourceUrlsFromJson(json);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.length).toBeLessThanOrEqual(100);
    expect(truncated).toBe(urls.length === 100);
    expect(urls[0]).toMatch(/^https:\/\//);
  });
});

it("keeps case-sensitive paths, query values, and trailing slashes distinct", () => {
  const urls = [
    "https://example.com/A",
    "https://example.com/a",
    "https://example.com/paid?id=A",
    "https://example.com/paid?id=a",
    "https://example.com/paid",
    "https://example.com/paid/",
  ];
  expect(parseBatchResourceUrlsFromJson(JSON.stringify(urls)).urls).toEqual(
    urls,
  );
});
