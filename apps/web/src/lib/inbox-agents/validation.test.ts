import { describe, expect, it } from "vitest";

import {
  isReservedInboxAgentSlug,
  normalizeInboxAgentSlug,
} from "./validation";

describe("inbox agent validation helpers", () => {
  it("normalizes inbox slugs using the sibling registry rules", () => {
    expect(normalizeInboxAgentSlug("  Héllo   Inbox!!! ")).toBe("hello-inbox");
  });

  it("detects reserved slugs after normalization", () => {
    expect(isReservedInboxAgentSlug("robots.txt")).toBe(true);
    expect(isReservedInboxAgentSlug("Róbots txt")).toBe(true);
    expect(isReservedInboxAgentSlug("support-inbox")).toBe(false);
  });
});
