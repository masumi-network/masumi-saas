import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

describe("isPaidTopUpAmountConsistentWithCredits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when amountTotal is null", async () => {
    const { isPaidTopUpAmountConsistentWithCredits } =
      await import("./checkout-amounts");
    expect(
      isPaidTopUpAmountConsistentWithCredits({
        credits: 10,
        amountTotal: null,
      }),
    ).toBe(false);
  });

  it("returns false when amount_total is off by one cent from an exact multiple", async () => {
    const { isPaidTopUpAmountConsistentWithCredits } =
      await import("./checkout-amounts");
    expect(
      isPaidTopUpAmountConsistentWithCredits({
        credits: 10,
        amountTotal: 10 * 5 - 1,
      }),
    ).toBe(false);
  });

  it("returns true when amount_total divides evenly by credits (any sane unit)", async () => {
    const { isPaidTopUpAmountConsistentWithCredits } =
      await import("./checkout-amounts");
    expect(
      isPaidTopUpAmountConsistentWithCredits({
        credits: 100,
        amountTotal: 100 * 5,
      }),
    ).toBe(true);
  });

  it("does not depend on current STRIPE_CREDIT_UNIT_AMOUNT_CENTS (in-flight deploy safety)", async () => {
    vi.stubEnv("STRIPE_CREDIT_UNIT_AMOUNT_CENTS", "999");
    const { isPaidTopUpAmountConsistentWithCredits } =
      await import("./checkout-amounts");
    expect(
      isPaidTopUpAmountConsistentWithCredits({
        credits: 10,
        amountTotal: 50,
      }),
    ).toBe(true);
  });

  it("returns false when credits do not divide amount_total evenly", async () => {
    const { isPaidTopUpAmountConsistentWithCredits } =
      await import("./checkout-amounts");
    expect(
      isPaidTopUpAmountConsistentWithCredits({ credits: 3, amountTotal: 10 }),
    ).toBe(false);
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

describe("top-up checkout metadata signatures", () => {
  it("round-trips metadata minted by the server", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    const { createTopUpCheckoutMetadata, parseVerifiedTopUpCheckoutMetadata } =
      await import("./top-up-metadata");

    const metadata = createTopUpCheckoutMetadata({
      userId: "user-1",
      credits: 500,
      amountTotalCents: 2_500,
    });

    expect(parseVerifiedTopUpCheckoutMetadata(metadata)).toEqual({
      purpose: "credit_topup",
      userId: "user-1",
      credits: 500,
      amountTotalCents: 2_500,
      currency: "usd",
    });
  });

  it("rejects tampered metadata even when the purpose marker is present", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    const { createTopUpCheckoutMetadata, parseVerifiedTopUpCheckoutMetadata } =
      await import("./top-up-metadata");

    const metadata = createTopUpCheckoutMetadata({
      userId: "user-1",
      credits: 500,
      amountTotalCents: 2_500,
    });

    expect(
      parseVerifiedTopUpCheckoutMetadata({
        ...metadata,
        credits: "500000",
      }),
    ).toBeNull();
  });
});
