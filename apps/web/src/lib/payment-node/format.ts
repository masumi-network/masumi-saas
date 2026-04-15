/** Shared payment-node display helpers used by activity, transactions, and earnings API routes. */

import { getKnownStableTokenByUnit, getKnownTokenByUnit } from "./tokens";

export type Network = "Mainnet" | "Preprod";

export function toNetwork(n: string | null): Network {
  return n === "Mainnet" || n === "Preprod" ? n : "Preprod";
}

function formatDecimal(
  value: number,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/** Format a single unit+amount; known stablecoins use 6 decimals. */
export function formatUnitAmount(
  unit: string,
  amount: number | string,
): string {
  // BigInt() throws on fractional numbers; round when amount is from API (number)
  const amountStr =
    typeof amount === "number" ? String(Math.round(amount)) : String(amount);
  if (unit === "" || unit === "lovelace") {
    const lovelace = BigInt(amountStr);
    const ada = Number(lovelace) / 1_000_000;
    return formatDecimal(ada, 0, 6) + " ADA";
  }

  const knownToken = getKnownTokenByUnit(unit);
  if (knownToken) {
    const raw = Number(BigInt(amountStr));
    const value = raw / 10 ** knownToken.decimals;
    return formatDecimal(value, 2, 2) + " " + knownToken.symbol;
  }

  return `${amountStr} ${unit.slice(0, 8)}`;
}

export function formatRequestedAmount(
  requestedFunds?: Array<{ unit: string; amount: string }>,
): string {
  if (!requestedFunds?.length) return "—";
  const first = requestedFunds[0]!;
  return formatUnitAmount(first.unit, first.amount);
}

/** Format earnings-style units (amount as number); empty unit = ADA (lovelace). */
export function formatUnits(
  units: Array<{ unit: string; amount: number }>,
): string {
  if (!units.length) return "0";
  return units.map((u) => formatUnitAmount(u.unit, u.amount)).join(", ");
}

/** Format earnings as USD when units are supported stablecoins. Falls back to formatUnits for ADA/other. */
export function formatEarningsAsUsd(
  units: Array<{ unit: string; amount: number }>,
): string {
  if (!units.length) return "$0.00";
  let usdCents = 0;
  const other: Array<{ unit: string; amount: number }> = [];
  for (const u of units) {
    const stableToken = getKnownStableTokenByUnit(u.unit);
    if (!stableToken) {
      other.push(u);
      continue;
    }

    usdCents += Math.round(Number(u.amount) / 10 ** (stableToken.decimals - 2));
  }
  const usdFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdCents / 100);
  if (other.length === 0) return usdFormatted;
  const rest = other.map((u) => formatUnitAmount(u.unit, u.amount)).join(", ");
  return usdCents > 0 ? `${usdFormatted} + ${rest}` : rest;
}

/** How to interpret dashboard chart `amount` and `total` (payment-node withdrawn income). */
export type DashboardEarningsAmountUnit = "USD" | "ADA";

/**
 * Split payment-node income `Units` into supported stablecoins (as USD float)
 * and ADA (from lovelace). Unknown units are ignored for the dashboard aggregate.
 */
export function splitIncomeUnitsStablecoinUsdAndAda(
  units: Array<{ unit: string; amount: number }>,
  network: Network,
): { usd: number; ada: number } {
  let usd = 0;
  let ada = 0;
  for (const u of units) {
    if (u.unit === "" || u.unit === "lovelace") {
      ada += Number(u.amount) / 1_000_000;
      continue;
    }

    const stableToken = getKnownStableTokenByUnit(u.unit, network);
    if (stableToken) {
      usd += Number(u.amount) / 10 ** stableToken.decimals;
    }
  }
  return { usd, ada };
}

/** Choose USD when any stablecoin income exists in the period; else ADA if only lovelace; else USD for empty. */
export function dashboardEarningsUnitFromTotals(totals: {
  usd: number;
  ada: number;
}): DashboardEarningsAmountUnit {
  if (totals.usd > 0) return "USD";
  if (totals.ada > 0) return "ADA";
  return "USD";
}

export function formatDashboardEarningsTotal(
  value: number,
  unit: DashboardEarningsAmountUnit,
): string {
  if (unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} ADA`;
}

/**
 * Absolute integer % change vs a previous total (dashboard “vs prev. period”).
 * Only call when `previous > 0` (callers should guard).
 */
export function earningsPercentChangeMagnitude(
  current: number,
  previous: number,
): number {
  return Math.abs(Math.round(((current - previous) / previous) * 100));
}
