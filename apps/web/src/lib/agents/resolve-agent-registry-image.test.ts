import { describe, expect, it } from "vitest";

import {
  resolveAgentRegistryImage,
  resolvePresetAgentIconUrl,
} from "./resolve-agent-registry-image";

describe("resolveAgentRegistryImage", () => {
  it("returns https URLs unchanged", () => {
    expect(resolveAgentRegistryImage("https://cdn.example/icon.png")).toBe(
      "https://cdn.example/icon.png",
    );
  });

  it("normalizes protocol-relative URLs", () => {
    expect(resolveAgentRegistryImage("//cdn.example/icon.png")).toBe(
      "https://cdn.example/icon.png",
    );
  });

  it("maps preset keys to IPFS icon URLs", () => {
    expect(resolveAgentRegistryImage("bot")).toBe(
      resolvePresetAgentIconUrl("bot"),
    );
    expect(resolveAgentRegistryImage("bot")).toMatch(/^ipfs:\/\//);
  });

  it("returns undefined for empty or unknown values", () => {
    expect(resolveAgentRegistryImage(null)).toBeUndefined();
    expect(resolveAgentRegistryImage("")).toBeUndefined();
    expect(resolveAgentRegistryImage("not-a-preset")).toBeUndefined();
  });
});
