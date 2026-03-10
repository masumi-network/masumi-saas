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
