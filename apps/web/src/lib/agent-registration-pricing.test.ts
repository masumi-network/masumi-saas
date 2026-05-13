import { describe, expect, it, vi } from "vitest";

vi.mock("@masumi/database/client", () => ({
  default: {},
}));

import { buildAgentPricing } from "./agent-registration";

describe("buildAgentPricing", () => {
  it("returns Dynamic for Dynamic pricingType", () => {
    expect(buildAgentPricing("Mainnet", { pricingType: "Dynamic" })).toEqual({
      pricingType: "Dynamic",
    });
  });

  it("maps Fixed prices to on-chain units", () => {
    const result = buildAgentPricing("Mainnet", {
      pricingType: "Fixed",
      prices: [{ amount: "1", currency: "USD" }],
    });
    expect(result).toMatchObject({ pricingType: "Fixed" });
    if (result.pricingType !== "Fixed") throw new Error("expected Fixed");
    expect(result.Pricing[0]?.amount).toBeTruthy();
  });

  it("defaults to Free when pricing is omitted", () => {
    expect(buildAgentPricing("Preprod", undefined)).toEqual({
      pricingType: "Free",
    });
  });
});
