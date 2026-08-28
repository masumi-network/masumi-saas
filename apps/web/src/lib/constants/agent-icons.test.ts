import { describe, expect, it } from "vitest";

import {
  AGENT_ICON_PRESET_KEYS,
  formatAgentIconLabel,
  searchAgentIconKeys,
} from "./agent-icons";

describe("agent-icons", () => {
  it("formats camelCase keys as labels", () => {
    expect(formatAgentIconLabel("fileText")).toBe("File Text");
    expect(formatAgentIconLabel("bot")).toBe("Bot");
  });

  it("returns all presets when search is empty", () => {
    expect(searchAgentIconKeys("")[0]).toBe("bot");
    expect(searchAgentIconKeys("")).toEqual(AGENT_ICON_PRESET_KEYS);
    expect(searchAgentIconKeys("   ")).toEqual(AGENT_ICON_PRESET_KEYS);
  });

  it("filters presets by key or label", () => {
    expect(searchAgentIconKeys("bot")).toEqual(["bot"]);
    expect(searchAgentIconKeys("chart")).toContain("barChart");
    expect(searchAgentIconKeys("chart")).toContain("chartLine");
    expect(searchAgentIconKeys("zzz")).toEqual([]);
  });
});
