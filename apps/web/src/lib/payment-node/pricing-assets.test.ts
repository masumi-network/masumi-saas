import { describe, expect, it } from "vitest";

import {
  estimatePriceUsd,
  getDefaultPricingAssetId,
  getPricingAssetOptions,
  humanAmountToSmallestUnit,
  resolvePricingAssetOption,
} from "./pricing-assets";
import { USDCX, USDM } from "./tokens";

describe("pricing-assets", () => {
  it("defaults to USDCx on Mainnet and tUSDM on Preprod", () => {
    expect(getDefaultPricingAssetId("Mainnet")).toBe("USDCx");
    expect(getDefaultPricingAssetId("Preprod")).toBe("tUSDM");
  });

  it("lists stablecoins and ADA per network", () => {
    expect(
      getPricingAssetOptions("Mainnet").map((option) => option.id),
    ).toEqual(["USDCx", "USDM", "ADA"]);
    expect(
      getPricingAssetOptions("Preprod").map((option) => option.id),
    ).toEqual(["tUSDM", "ADA"]);
  });

  it("converts human amounts to smallest units", () => {
    const usdcx = resolvePricingAssetOption("USDCx", "Mainnet");
    expect(humanAmountToSmallestUnit("1.5", usdcx)).toBe("1500000");

    const ada = resolvePricingAssetOption("ADA", "Mainnet");
    expect(humanAmountToSmallestUnit("2", ada)).toBe("2000000");
  });

  it("keeps large amounts exact without scientific notation", () => {
    const usdcx = resolvePricingAssetOption("USDCx", "Mainnet");
    // 10,000,000,000 tokens * 1e6 = 1e16 base units, exact.
    expect(humanAmountToSmallestUnit("10000000000", usdcx)).toBe(
      "10000000000000000",
    );
    expect(humanAmountToSmallestUnit("0.000001", usdcx)).toBe("1");
    expect(humanAmountToSmallestUnit("0.5", usdcx)).toBe("500000");
  });

  it("rejects invalid, negative, scientific-notation and over-precise amounts", () => {
    const usdcx = resolvePricingAssetOption("USDCx", "Mainnet");
    expect(() => humanAmountToSmallestUnit("", usdcx)).toThrow();
    expect(() => humanAmountToSmallestUnit("-1", usdcx)).toThrow();
    expect(() => humanAmountToSmallestUnit("1e21", usdcx)).toThrow();
    expect(() => humanAmountToSmallestUnit("abc", usdcx)).toThrow();
    // 7 fractional digits exceeds USDCx's 6 decimals.
    expect(() => humanAmountToSmallestUnit("1.1234567", usdcx)).toThrow();
  });

  it("estimates USD for stablecoins and ADA", () => {
    expect(estimatePriceUsd("5", "USDCx", "Mainnet", null)).toBe(5);
    expect(estimatePriceUsd("10", USDM.Preprod.symbol, "Preprod", null)).toBe(
      10,
    );
    expect(estimatePriceUsd("2", "ADA", "Mainnet", 0.5)).toBe(1);
    expect(estimatePriceUsd("2", "ADA", "Mainnet", null)).toBeNull();
  });

  it("resolves USDCx unit for mainnet fixed pricing assets", () => {
    const asset = resolvePricingAssetOption("USDCx", "Mainnet");
    expect(asset.unit).toBe(USDCX.unit);
  });
});
