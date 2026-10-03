import { paymentNodeConfig, type PaymentNodeNetwork } from "@/lib/payment-node";

export type RegistryLookupFilter = {
  filterSmartContractAddress?: string;
  filterPaymentSourceType?: "Web3CardanoV1" | "Web3CardanoV2";
};

/** Resolve registry list filters for a single agent ref (by-id lookups). */
export function resolveRegistryLookupFilter(
  refMetadata: unknown,
  network: PaymentNodeNetwork,
): RegistryLookupFilter {
  const meta =
    refMetadata && typeof refMetadata === "object"
      ? (refMetadata as Record<string, unknown>)
      : {};
  const fromMeta =
    typeof meta.smartContractAddress === "string"
      ? meta.smartContractAddress.trim()
      : "";
  if (fromMeta) {
    return { filterSmartContractAddress: fromMeta };
  }
  const fromConfig = paymentNodeConfig.tryGetSmartContractAddress(network);
  if (fromConfig) {
    return { filterSmartContractAddress: fromConfig };
  }
  return { filterPaymentSourceType: "Web3CardanoV2" };
}

/**
 * Registry list filters for SaaS agent visibility. V2-only for new work; legacy
 * agents remain reachable via per-agent smartContractAddress in metadata.
 */
export function getRegistryListFilters(
  network: PaymentNodeNetwork,
): RegistryLookupFilter[] {
  const contractAddress = paymentNodeConfig.tryGetSmartContractAddress(network);
  if (contractAddress) {
    return [{ filterSmartContractAddress: contractAddress }];
  }
  return [{ filterPaymentSourceType: "Web3CardanoV2" }];
}
