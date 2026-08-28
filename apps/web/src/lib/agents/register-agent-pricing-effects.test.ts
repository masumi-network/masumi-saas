import { describe, expect, it, vi } from "vitest";

import { syncPricesValidationAfterPricingModeChange } from "./register-agent-pricing-effects";

describe("syncPricesValidationAfterPricingModeChange", () => {
  it("clears stale fixed-price errors when switching to Free", () => {
    const clearErrors = vi.fn();
    const trigger = vi.fn();

    syncPricesValidationAfterPricingModeChange("Free", {
      clearErrors,
      trigger,
    });

    expect(clearErrors).toHaveBeenCalledWith("prices");
    expect(trigger).not.toHaveBeenCalled();
  });

  it("clears stale fixed-price errors when switching to Dynamic", () => {
    const clearErrors = vi.fn();
    const trigger = vi.fn();

    syncPricesValidationAfterPricingModeChange("Dynamic", {
      clearErrors,
      trigger,
    });

    expect(clearErrors).toHaveBeenCalledWith("prices");
    expect(trigger).not.toHaveBeenCalled();
  });

  it("revalidates prices when switching back to Fixed", () => {
    const clearErrors = vi.fn();
    const trigger = vi.fn().mockResolvedValue(true);

    syncPricesValidationAfterPricingModeChange("Fixed", {
      clearErrors,
      trigger,
    });

    expect(clearErrors).not.toHaveBeenCalled();
    expect(trigger).toHaveBeenCalledWith("prices");
  });
});
