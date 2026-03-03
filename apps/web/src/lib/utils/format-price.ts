/**
 * Format a numeric amount for display (comma-separated, e.g. "1,234.56")
 */
export function formatBalance(balance: string | number): string {
  if (balance === "" || balance == null) return "";
  const cleanValue = String(balance).replace(/[^\d.]/g, "");
  const parts = cleanValue.split(".");
  const integerPart = parts[0] ?? "0";
  const decimalPart = parts[1];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

export type AgentPricing =
  | { pricingType: "Free" }
  | {
      pricingType: "Fixed";
      prices: Array<{ amount: string; currency?: string }>;
    };

/**
 * Format agent pricing for display - crypto-less, dollar-based
 * Returns "Free", "$5.00", "$5.00, $10.00", or "—" if empty
 */
export function formatPricingDisplay(
  pricing: AgentPricing | null | undefined | Record<string, unknown>,
): string {
  if (!pricing || typeof pricing !== "object") return "—";
  if ((pricing as AgentPricing).pricingType === "Free") return "Free";
  const fixed = pricing as {
    pricingType?: string;
    prices?: Array<{ amount: string }>;
    Pricing?: Array<{ amount: string }>; // legacy
  };
  const priceList = fixed.prices ?? fixed.Pricing ?? [];
  if (fixed.pricingType === "Fixed" && priceList.length) {
    return (
      priceList
        .map((p) => {
          const raw = parseFloat(p.amount);
          if (Number.isNaN(raw)) return null;
          // Amounts are stored in on-chain units (6 decimals, like USDM/tUSDM)
          const dollars = raw / 1_000_000;
          return `$${formatBalance(dollars.toFixed(2))}`;
        })
        .filter(Boolean)
        .join(", ") || "—"
    );
  }
  return "—";
}
