import { describe, expect, it } from "vitest";

import { formatUnitAmount } from "./format";
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
