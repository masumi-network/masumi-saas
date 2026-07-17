import type {
  PaymentNodeClient,
  PaymentNodeNetwork,
} from "@/lib/payment-node/client";
import { formatUnitAmount } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

import type { BalanceAmount } from "./schemas";
import { resolveSellingWalletAddresses } from "./selling-wallet-addresses";

const ZERO_LOVELACE = BigInt(0);

export function readLovelaceFromBalanceAmounts(
  amounts: ReadonlyArray<Pick<BalanceAmount, "unit" | "quantity">>,
): bigint {
  let total = ZERO_LOVELACE;
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
  return readLovelaceFromBalanceAmounts(amounts) > ZERO_LOVELACE;
}

export async function fetchAddressBalance(
  client: PaymentNodeClient,
  params: { address: string; network: PaymentNodeNetwork },
): Promise<BalanceAmount[]> {
  const { Balance } = await client.getBalance(params);
  return Balance;
}

export async function checkAddressHasConfirmedBalance(
  client: PaymentNodeClient,
  params: { address: string; network: PaymentNodeNetwork },
): Promise<boolean> {
  try {
    const balance = await fetchAddressBalance(client, params);
    return addressHasConfirmedBalance(balance);
  } catch (error) {
    console.error(
      "[Payment Node] Failed to check confirmed address balance:",
      error,
    );
    return false;
  }
}

export function formatLovelaceBalanceDisplay(lovelace: bigint): string {
  if (lovelace <= ZERO_LOVELACE) {
    return formatUnitAmount("lovelace", "0");
  }
  return formatUnitAmount("lovelace", lovelace.toString());
}

export async function resolveAdaBalanceForAddresses(
  client: PaymentNodeClient,
  network: PaymentNodeNetwork,
  addresses: string[],
): Promise<string> {
  const uniqueAddresses = [
    ...new Set(addresses.filter((address) => address.length > 0)),
  ];

  if (uniqueAddresses.length === 0) {
    return formatLovelaceBalanceDisplay(ZERO_LOVELACE);
  }

  let totalLovelace = ZERO_LOVELACE;
  for (const address of uniqueAddresses) {
    const balance = await fetchAddressBalance(client, { address, network });
    totalLovelace += readLovelaceFromBalanceAmounts(balance);
  }

  return formatLovelaceBalanceDisplay(totalLovelace);
}

export async function resolveUserSellingWalletsBalance(
  userId: string,
  network: PaymentNodeNetwork,
  options?: { organizationId?: string },
): Promise<string> {
  const addresses = await resolveSellingWalletAddresses({
    userId,
    organizationId: options?.organizationId,
  });

  const client = await getPaymentNodeClientForUser(userId);
  if (!client) {
    return formatLovelaceBalanceDisplay(ZERO_LOVELACE);
  }

  try {
    return await resolveAdaBalanceForAddresses(client, network, addresses);
  } catch (error) {
    console.error(
      "[Payment Node] Failed to resolve selling wallet balance:",
      error,
    );
    return formatLovelaceBalanceDisplay(ZERO_LOVELACE);
  }
}
