import { describe, expect, it } from "vitest";

import { stripHtml } from "./index";

describe("stripHtml", () => {
  it("returns empty string for non-string input", () => {
    expect(stripHtml("")).toBe("");
    expect(stripHtml(null as unknown as string)).toBe("");
  });

  it("removes simple HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("removes nested tag bypass attempts", () => {
    expect(stripHtml("<scr<script>ipt>alert(1)</script>")).toBe("iptalert(1)");
    expect(stripHtml("<<script>alert(1)</script>>")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(stripHtml("  <em> spaced </em>  ")).toBe("spaced");
  });
});
