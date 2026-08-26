export type RegisterAgentPricingMode = "Free" | "Fixed" | "Dynamic";

type PricesFormApi = {
  clearErrors: (name: "prices") => void;
  trigger: (name: "prices") => Promise<boolean>;
};

/** Keep price field errors aligned with the selected pricing mode. */
export function syncPricesValidationAfterPricingModeChange(
  pricingType: RegisterAgentPricingMode,
  form: PricesFormApi,
): void {
  if (pricingType === "Fixed") {
    void form.trigger("prices");
    return;
  }

  form.clearErrors("prices");
}
