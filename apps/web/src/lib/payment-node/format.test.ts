import { describe, expect, it } from "vitest";

import {
  formatEarningsAsUsd,
  formatUnitAmount,
  splitIncomeUnitsStablecoinUsdAndAda,
} from "./format";
import { USDCX, USDM } from "./tokens";

describe("formatUnitAmount", () => {
  it("formats ADA from empty unit", () => {
    expect(formatUnitAmount("", "1500000")).toBe("1.5 ADA");
  });

  it("formats ADA from lovelace alias", () => {
    expect(formatUnitAmount("lovelace", "2000000")).toBe("2 ADA");
  });

  it("formats preprod USDM", () => {
    expect(formatUnitAmount(USDM.Preprod.unit, "1234500")).toBe("1.23 tUSDM");
  });

  it("formats mainnet USDM", () => {
    expect(formatUnitAmount(USDM.Mainnet.unit, "1234500")).toBe("1.23 USDM");
  });

  it("formats mainnet USDCx", () => {
    expect(formatUnitAmount(USDCX.unit, "1234500")).toBe("1.23 USDCx");
  });

  it("formats mainnet USDC alias", () => {
    expect(formatUnitAmount("USDC", "1234500")).toBe("1.23 USDCx");
  });
});

describe("formatEarningsAsUsd", () => {
  it("aggregates supported stablecoins into USD", () => {
    expect(
      formatEarningsAsUsd([
        { unit: USDM.Mainnet.unit, amount: 1_250_000 },
        { unit: USDCX.unit, amount: 2_500_000 },
      ]),
    ).toBe("$3.75");
  });
});

describe("splitIncomeUnitsStablecoinUsdAndAda", () => {
  it("counts preprod tUSDM and ADA", () => {
    expect(
      splitIncomeUnitsStablecoinUsdAndAda(
        [
          { unit: USDM.Preprod.unit, amount: 1_500_000 },
          { unit: "", amount: 2_000_000 },
          { unit: USDCX.unit, amount: 9_900_000 },
        ],
        "Preprod",
      ),
    ).toEqual({
      usd: 1.5,
      ada: 2,
    });
  });

  it("counts mainnet USDM, USDCx, and ADA", () => {
    expect(
      splitIncomeUnitsStablecoinUsdAndAda(
        [
          { unit: USDM.Mainnet.unit, amount: 1_250_000 },
          { unit: USDCX.unit, amount: 2_500_000 },
          { unit: "lovelace", amount: 3_000_000 },
        ],
        "Mainnet",
      ),
    ).toEqual({
      usd: 3.75,
      ada: 3,
    });
  });
});
