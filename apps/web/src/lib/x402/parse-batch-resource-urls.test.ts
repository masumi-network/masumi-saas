import { describe, expect, it } from "vitest";

import {
  hasMultipleX402ResourceUrlsInInput,
  parseBatchResourceUrlsInput,
} from "./parse-batch-resource-urls";

describe("parseBatchResourceUrlsInput", () => {
  it("parses newline-separated URLs and dedupes", () => {
    const { urls, invalidLines } = parseBatchResourceUrlsInput(
      "https://a.example/one\nhttps://b.example/two\nhttps://a.example/one\n",
    );
    expect(urls).toHaveLength(2);
    expect(invalidLines).toHaveLength(0);
  });

  it("rejects non-http schemes", () => {
    const { urls, invalidLines } = parseBatchResourceUrlsInput(
      "ftp://bad.example/x\nhttps://ok.example/y",
    );
    expect(urls).toEqual(["https://ok.example/y"]);
    expect(invalidLines).toEqual(["ftp://bad.example/x"]);
  });

  it("detects multi-resource intent with two schemes before both URLs are complete", () => {
    expect(
      hasMultipleX402ResourceUrlsInInput(
        "https://x402.org/protected https://x402.vercel.app/prot",
      ),
    ).toBe(true);
  });

  it("parses space-separated URLs on one line", () => {
    const { urls } = parseBatchResourceUrlsInput(
      "https://a.example/one https://b.example/two",
    );
    expect(urls).toHaveLength(2);
  });

  it("caps at 100 URLs", () => {
    const lines = Array.from(
      { length: 105 },
      (_, i) => `https://host.example/path-${i}`,
    ).join("\n");
    const { urls } = parseBatchResourceUrlsInput(lines);
    expect(urls).toHaveLength(100);
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
  expect(parseBatchResourceUrlsInput(urls.join("\n")).urls).toEqual(urls);
});
