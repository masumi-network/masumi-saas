/** Shared payment-node display helpers used by activity, transactions, and earnings API routes. */

export type Network = "Mainnet" | "Preprod";

export function toNetwork(n: string | null): Network {
  return n === "Mainnet" || n === "Preprod" ? n : "Preprod";
}

export function formatRequestedAmount(
  requestedFunds?: Array<{ unit: string; amount: string }>,
): string {
  if (!requestedFunds?.length) return "—";
  const first = requestedFunds[0]!;
  if (first.unit === "") {
    const lovelace = BigInt(first.amount);
    const ada = Number(lovelace) / 1_000_000;
    return ada.toFixed(6) + " ADA";
  }
  return `${first.amount} ${first.unit.slice(0, 8)}`;
}

/** Format earnings-style units (amount as number); empty unit = ADA (lovelace). */
export function formatUnits(
  units: Array<{ unit: string; amount: number }>,
): string {
  if (!units.length) return "0";
  const ada = units.find((u) => u.unit === "");
  if (ada) {
    const lovelace = BigInt(ada.amount);
    const adaNum = Number(lovelace) / 1_000_000;
    return adaNum.toFixed(6) + " ADA";
  }
  return units.map((u) => `${u.amount} ${u.unit.slice(0, 8)}`).join(", ");
}
