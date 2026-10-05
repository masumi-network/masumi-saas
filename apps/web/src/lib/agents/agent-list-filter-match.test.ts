import { describe, expect, it } from "vitest";

import {
  classifyAgentPricingType,
  classifyAgentRegistrationKind,
  matchesAgentTypeFilter,
  matchesPricingTypeFilter,
} from "./agent-list-filter-match";

describe("agent list filter match", () => {
  it("classifies x402 from registry metadata", () => {
    expect(
      classifyAgentRegistrationKind({
        metadata: JSON.stringify({
          registryEntryType: "X402",
          x402Manifest: {
            x402Version: 1,
            resources: [{ resource: "https://example.com", type: "http" }],
          },
        }),
        agentReference: null,
      }),
    ).toBe("X402_HTTP");
  });

  it("classifies standard MIP agents", () => {
    expect(
      classifyAgentRegistrationKind({
        metadata: JSON.stringify({ apiBaseUrl: "https://api.example.com" }),
        agentReference: null,
      }),
    ).toBe("STANDARD");
  });

  it("matches pricing type filters", () => {
    const agent = { pricing: { pricingType: "Fixed" } };
    expect(matchesPricingTypeFilter(agent, "fixed")).toBe(true);
    expect(matchesPricingTypeFilter(agent, "free")).toBe(false);
    expect(classifyAgentPricingType(agent)).toBe("Fixed");
  });

  it("matches agent type filters", () => {
    const x402 = {
      metadata: JSON.stringify({ registryEntryType: "X402" }),
      agentReference: null,
    };
    expect(matchesAgentTypeFilter(x402, "x402")).toBe(true);
    expect(matchesAgentTypeFilter(x402, "standard")).toBe(false);
  });
});
