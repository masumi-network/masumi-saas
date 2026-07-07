import { describe, expect, it } from "vitest";

import { USDCX } from "@/lib/payment-node/tokens";

import {
  formatPricingDisplay,
  formatPricingDisplayCompact,
} from "./format-price";

describe("formatPricingDisplay", () => {
  it("returns Free and Dynamic labels", () => {
    expect(formatPricingDisplay({ pricingType: "Free" })).toBe("Free");
    expect(formatPricingDisplay({ pricingType: "Dynamic" })).toBe("Dynamic");
  });

  it("formats on-chain fixed pricing with asset symbols", () => {
    expect(
      formatPricingDisplay({
        pricingType: "Fixed",
        Pricing: [{ unit: USDCX.unit, amount: "1000000000" }],
      }),
    ).toBe("1,000.00 USDCx");
  });

  it("formats ADA fixed pricing from lovelace", () => {
    expect(
      formatPricingDisplay({
        pricingType: "Fixed",
        Pricing: [{ unit: "", amount: "5000000" }],
      }),
    ).toBe("5 ADA");
  });

  it("formats registry FixedPricing amounts", () => {
    expect(
      formatPricingDisplay({
        pricingType: "Fixed",
        FixedPricing: {
          Amounts: [{ unit: USDCX.unit, amount: "2500000" }],
        },
      }),
    ).toBe("2.50 USDCx");
  });

  it("keeps legacy human dollar prices", () => {
    expect(
      formatPricingDisplay({
        pricingType: "Fixed",
        prices: [{ amount: "5", currency: "USD" }],
      }),
    ).toBe("$5.00");
  });
});

describe("formatPricingDisplayCompact", () => {
  it("returns a single price unchanged", () => {
    expect(
      formatPricingDisplayCompact({
        pricingType: "Fixed",
        Pricing: [{ unit: USDCX.unit, amount: "1000000000" }],
      }),
    ).toBe("1,000.00 USDCx");
  });

  it("shows first price and count of extras", () => {
    expect(
      formatPricingDisplayCompact({
        pricingType: "Fixed",
        Pricing: [
          { unit: USDCX.unit, amount: "1000000" },
          { unit: "", amount: "5000000" },
          { unit: USDCX.unit, amount: "2000000" },
        ],
      }),
    ).toBe("1.00 USDCx +2");
  });

  it("returns Free and Dynamic unchanged", () => {
    expect(formatPricingDisplayCompact({ pricingType: "Free" })).toBe("Free");
    expect(formatPricingDisplayCompact({ pricingType: "Dynamic" })).toBe(
      "Dynamic",
    );
  });
});
