import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { validateCardanoAddress } from "./validate-cardano-address";

/**
 * Trim and validate a Shelley receive address for the agent’s payment network.
 * Used for Payment Service `AddSellingWallets[].collectionAddress`.
 */
export function parseValidAgentCollectionAddress(
  raw: string,
  network: PaymentNodeNetwork,
): { ok: true; address: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Collection address is required." };
  }
  const validated = validateCardanoAddress(trimmed, network);
  if (!validated.isValid) {
    return {
      ok: false,
      error:
        network === "Mainnet"
          ? "Invalid Cardano mainnet address. Use a Shelley receive address starting with addr1."
          : "Invalid Cardano Preprod address. Use a Shelley receive address starting with addr_test1.",
    };
  }
  return { ok: true, address: validated.normalizedAddress };
}
