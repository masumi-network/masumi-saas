/** Shared payment-node display helpers used by activity, transactions, and earnings API routes. */

import { USDM } from "@/lib/payment-node/tokens";

export type Network = "Mainnet" | "Preprod";

export function toNetwork(n: string | null): Network {
  return n === "Mainnet" || n === "Preprod" ? n : "Preprod";
}

/** Format a single unit+amount; known stablecoins (USDM/tUSDM) use 6 decimals. */
function formatOneUnitAmount(unit: string, amount: number | string): string {
  // BigInt() throws on fractional numbers; round when amount is from API (number)
  const amountStr =
    typeof amount === "number" ? String(Math.round(amount)) : String(amount);
  if (unit === "") {
    const lovelace = BigInt(amountStr);
    const ada = Number(lovelace) / 1_000_000;
    return ada.toFixed(6) + " ADA";
  }
  if (unit === USDM.Preprod.unit) {
    const raw = Number(BigInt(amountStr));
    const value = raw / 10 ** USDM.Preprod.decimals;
    return value.toFixed(2) + " " + USDM.Preprod.symbol;
  }
  if (unit === USDM.Mainnet.unit) {
    const raw = Number(BigInt(amountStr));
    const value = raw / 10 ** USDM.Mainnet.decimals;
    return value.toFixed(2) + " " + USDM.Mainnet.symbol;
  }
  return `${amountStr} ${unit.slice(0, 8)}`;
}

export function formatRequestedAmount(
  requestedFunds?: Array<{ unit: string; amount: string }>,
): string {
  if (!requestedFunds?.length) return "—";
  const first = requestedFunds[0]!;
  return formatOneUnitAmount(first.unit, first.amount);
}

/** Format earnings-style units (amount as number); empty unit = ADA (lovelace). */
export function formatUnits(
  units: Array<{ unit: string; amount: number }>,
): string {
  if (!units.length) return "0";
  return units.map((u) => formatOneUnitAmount(u.unit, u.amount)).join(", ");
}
