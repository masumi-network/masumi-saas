import { deserializeAddress } from "@meshsdk/core";

export type CardanoLedgerNetwork = "Mainnet" | "Preprod";

export type ValidateCardanoAddressResult =
  | { isValid: false }
  | { isValid: true; normalizedAddress: string };

/**
 * Validates a Shelley Cardano receive address (Bech32) for Mainnet or Preprod.
 * Mirrors masumi-payment-service `validateCardanoAddress` (Mesh deserializeAddress).
 * On success, returns the canonical lowercase form (Bech32) for storage and APIs.
 */
export function validateCardanoAddress(
  address: string,
  network: CardanoLedgerNetwork,
): ValidateCardanoAddressResult {
  if (!address || typeof address !== "string") {
    return { isValid: false };
  }

  const trimmed = address.trim();
  if (trimmed.length === 0) {
    return { isValid: false };
  }

  const normalized = trimmed.toLowerCase();
  const expectedPrefix = network === "Mainnet" ? "addr1" : "addr_test1";
  if (!normalized.startsWith(expectedPrefix)) {
    return { isValid: false };
  }

  try {
    deserializeAddress(normalized);
    return { isValid: true, normalizedAddress: normalized };
  } catch {
    return { isValid: false };
  }
}
