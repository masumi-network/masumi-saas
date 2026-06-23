import { describe, expect, it } from "vitest";

describe("credit top-up amount bounds", () => {
  it("allows preset-sized amounts and custom within range", async () => {
    const { isAllowedCreditTopUpAmount } = await import("./top-up-constants");
    expect(isAllowedCreditTopUpAmount(1)).toBe(true);
    expect(isAllowedCreditTopUpAmount(337)).toBe(true);
    expect(isAllowedCreditTopUpAmount(500_000)).toBe(true);
  });

  it("rejects fractions, negatives, zero, and out-of-range totals", async () => {
    const { isAllowedCreditTopUpAmount } = await import("./top-up-constants");
    expect(isAllowedCreditTopUpAmount(0)).toBe(false);
    expect(isAllowedCreditTopUpAmount(-10)).toBe(false);
    expect(isAllowedCreditTopUpAmount(10.25)).toBe(false);
    expect(isAllowedCreditTopUpAmount(500_001)).toBe(false);
  });
});
