import { isCardanoAddressForNetwork } from "@masumi/payment-source-x402/payment-source";

import type { PaymentNodeNetwork } from "./client";

export function normalizePayoutAddress(address: string): string {
  return address.trim();
}

export function validatePayoutAddressForNetwork(
  address: string,
  network: PaymentNodeNetwork,
): string | null {
  const normalized = normalizePayoutAddress(address);
  if (!normalized) {
    return "Payout address is required.";
  }
  if (!isCardanoAddressForNetwork(normalized, network)) {
    return network === "Mainnet"
      ? "Payout address must be a Mainnet Cardano address (addr1…)."
      : "Payout address must be a Preprod Cardano address (addr_test…).";
  }
  return null;
}
