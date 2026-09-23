import { describe, expect, it, vi } from "vitest";

vi.mock("@masumi/database/client", () => ({
  default: {},
}));

import { buildAgentPricing } from "./agent-registration";
import { USDCX } from "./payment-node/tokens";

describe("buildAgentPricing", () => {
  it("returns Dynamic for Dynamic pricingType", () => {
    expect(buildAgentPricing("Mainnet", { pricingType: "Dynamic" })).toEqual({
      pricingType: "Dynamic",
    });
  });

  it("maps Fixed USDCx prices to on-chain units", () => {
    const result = buildAgentPricing("Mainnet", {
      pricingType: "Fixed",
      prices: [{ amount: "1", currency: "USDCx" }],
    });
    expect(result).toMatchObject({ pricingType: "Fixed" });
    if (result.pricingType !== "Fixed") throw new Error("expected Fixed");
    expect(result.Pricing[0]).toEqual({
      unit: USDCX.unit,
      amount: "1000000",
    });
  });

  it("maps Fixed ADA prices to lovelace", () => {
    const result = buildAgentPricing("Mainnet", {
      pricingType: "Fixed",
      prices: [{ amount: "2", currency: "ADA" }],
    });
    if (result.pricingType !== "Fixed") throw new Error("expected Fixed");
    expect(result.Pricing[0]).toEqual({
      unit: "",
      amount: "2000000",
    });
  });

  it("defaults to Free when pricing is omitted", () => {
    expect(buildAgentPricing("Preprod", undefined)).toEqual({
      pricingType: "Free",
    });
  });
});
