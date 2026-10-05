import { afterEach, describe, expect, it, vi } from "vitest";

import { isAgentDetailsEditEnabled } from "./agent-details-edit.config";

describe("isAgentDetailsEditEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when the flag is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT", undefined);
    expect(isAgentDetailsEditEnabled()).toBe(false);
  });

  it("is on only for an explicit true", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT", " TRUE ");
    expect(isAgentDetailsEditEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT", "1");
    expect(isAgentDetailsEditEnabled()).toBe(false);
  });
});
