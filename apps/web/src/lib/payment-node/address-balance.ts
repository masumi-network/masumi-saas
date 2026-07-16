import type {
  PaymentNodeClient,
  PaymentNodeNetwork,
} from "@/lib/payment-node/client";
import { formatUnitAmount } from "@/lib/payment-node/format";

import type { BalanceAmount } from "./schemas";

export function readLovelaceFromBalanceAmounts(
  amounts: ReadonlyArray<Pick<BalanceAmount, "unit" | "quantity">>,
): bigint {
  let total = 0n;
  for (const entry of amounts) {
    if (entry.unit === "" || entry.unit === "lovelace") {
      total += BigInt(entry.quantity);
    }
  }
  return total;
}

export function addressHasConfirmedBalance(
  amounts: ReadonlyArray<Pick<BalanceAmount, "unit" | "quantity">>,
): boolean {
  return readLovelaceFromBalanceAmounts(amounts) > 0n;
}

export async function fetchAddressBalance(
  client: PaymentNodeClient,
  params: { address: string; network: PaymentNodeNetwork },
): Promise<BalanceAmount[]> {
  const { Balance } = await client.getBalance(params);
  return Balance;
}

export function formatLovelaceBalanceDisplay(lovelace: bigint): string {
  if (lovelace <= 0n) {
    return formatUnitAmount("lovelace", "0");
  }
  return formatUnitAmount("lovelace", lovelace.toString());
}

export async function resolveSellingWalletsAdaBalance(
  client: PaymentNodeClient,
  network: PaymentNodeNetwork,
): Promise<string> {
  const { Wallets } = await client.getWalletList({ walletType: "Selling" });
  const addresses = [
    ...new Set(
      Wallets.map((wallet) => wallet.walletAddress).filter(
        (address) => address.length > 0,
      ),
    ),
  ];

  if (addresses.length === 0) {
    return formatLovelaceBalanceDisplay(0n);
  }

  let totalLovelace = 0n;
  for (const address of addresses) {
    const balance = await fetchAddressBalance(client, { address, network });
    totalLovelace += readLovelaceFromBalanceAmounts(balance);
  }

  return formatLovelaceBalanceDisplay(totalLovelace);
}
