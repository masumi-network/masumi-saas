import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("isExpectedCheckoutAmount", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_CREDIT_UNIT_AMOUNT_CENTS", "5");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when amountTotal is null", async () => {
    const { isExpectedCheckoutAmount } = await import("./checkout-amounts");
    expect(isExpectedCheckoutAmount({ credits: 10, amountTotal: null })).toBe(
      false,
    );
  });

  it("returns false when amountTotal is off by one cent from expected", async () => {
    const { isExpectedCheckoutAmount } = await import("./checkout-amounts");
    expect(
      isExpectedCheckoutAmount({ credits: 10, amountTotal: 10 * 5 - 1 }),
    ).toBe(false);
  });

  it("returns true when amount matches credits × unit cents", async () => {
    const { isExpectedCheckoutAmount } = await import("./checkout-amounts");
    expect(
      isExpectedCheckoutAmount({ credits: 100, amountTotal: 100 * 5 }),
    ).toBe(true);
  });
});

describe("isValidStripeCheckoutSessionId (via verify module)", () => {
  it("accepts test and live prefixes", async () => {
    const { isValidStripeCheckoutSessionId } =
      await import("./verify-return-session");
    expect(isValidStripeCheckoutSessionId("cs_test_abc12")).toBe(true);
    expect(isValidStripeCheckoutSessionId("cs_live_xyz09")).toBe(true);
  });

  it("rejects garbage", async () => {
    const { isValidStripeCheckoutSessionId } =
      await import("./verify-return-session");
    expect(isValidStripeCheckoutSessionId("not_cs")).toBe(false);
    expect(isValidStripeCheckoutSessionId("cs_pretend_1")).toBe(false);
    expect(isValidStripeCheckoutSessionId("")).toBe(false);
  });
});
