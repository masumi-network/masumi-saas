/**
 * Format a numeric amount for display (comma-separated, e.g. "1,234.56")
 */
import { formatUnitAmount as formatPaymentUnitAmount } from "@/lib/payment-node/format";

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
  | { pricingType: "Dynamic" }
  | {
      pricingType: "Fixed";
      prices?: Array<{ amount: string; currency?: string }>;
      Pricing?: Array<{ unit?: string; amount: string }>;
      FixedPricing?: {
        Amounts: Array<{ unit: string; amount: string | number }>;
      };
    };

type FixedPricingAmount = { unit?: string; amount: string | number };

function formatLegacyPrice(price: {
  amount: string;
  currency?: string;
}): string | null {
  const raw = parseFloat(price.amount);
  if (Number.isNaN(raw)) return null;
  const currency = price.currency?.trim();
  if (currency && currency !== "USD") {
    return `${formatBalance(raw.toFixed(2))} ${currency}`;
  }
  return `$${formatBalance(raw.toFixed(2))}`;
}

function collectFixedPriceLabels(
  pricing: AgentPricing | null | undefined | Record<string, unknown>,
): string[] | null {
  if (!pricing || typeof pricing !== "object") return null;
  if ((pricing as AgentPricing).pricingType === "Free") return ["Free"];
  if ((pricing as AgentPricing).pricingType === "Dynamic") return ["Dynamic"];

  const fixed = pricing as AgentPricing & {
    pricingType?: string;
    prices?: Array<{ amount: string; currency?: string }>;
    Pricing?: Array<{ unit?: string; amount: string }>;
    FixedPricing?: {
      Amounts: Array<{ unit: string; amount: string | number }>;
    };
  };

  if (fixed.pricingType !== "Fixed") return null;

  if (fixed.FixedPricing?.Amounts?.length) {
    return fixed.FixedPricing.Amounts.map((entry) =>
      formatPaymentUnitAmount(entry.unit ?? "", String(entry.amount)),
    );
  }

  if (fixed.Pricing?.length) {
    return fixed.Pricing.map((entry) =>
      formatPaymentUnitAmount(entry.unit ?? "", String(entry.amount)),
    );
  }

  const legacyPrices = fixed.prices ?? [];
  if (legacyPrices.length > 0) {
    const labels = legacyPrices
      .map((price) => formatLegacyPrice(price))
      .filter((label): label is string => Boolean(label));
    return labels.length > 0 ? labels : null;
  }

  return null;
}

/**
 * Format agent pricing for display.
 * Returns "Free", "Dynamic", "1.00 USDCx", "10.00 ADA", or "—" if empty.
 */
export function formatPricingDisplay(
  pricing: AgentPricing | null | undefined | Record<string, unknown>,
): string {
  const labels = collectFixedPriceLabels(pricing);
  if (!labels) return "—";
  return labels.join(", ");
}

/**
 * Compact pricing for list views: first price only, then "+N" for extras.
 * Example: "1,000.00 USDCx +2"
 */
export function getPricingDisplayCompactParts(
  pricing: AgentPricing | null | undefined | Record<string, unknown>,
): { primary: string; extraCount: number } | null {
  const labels = collectFixedPriceLabels(pricing);
  if (!labels || labels.length === 0) return null;
  return {
    primary: labels[0]!,
    extraCount: Math.max(0, labels.length - 1),
  };
}

export function formatPricingDisplayCompact(
  pricing: AgentPricing | null | undefined | Record<string, unknown>,
): string {
  const parts = getPricingDisplayCompactParts(pricing);
  if (!parts) return "—";
  if (parts.extraCount === 0) return parts.primary;
  return `${parts.primary} +${parts.extraCount}`;
}
