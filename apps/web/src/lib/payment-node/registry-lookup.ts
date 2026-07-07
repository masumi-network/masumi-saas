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
 * Registry list defaults to V1 when unfiltered. Merge V2 (configured source)
 * with V1 so confirmed wallet-owned agents stay visible after registration.
 */
export function getRegistryListFilters(
  network: PaymentNodeNetwork,
): RegistryLookupFilter[] {
  const filters: RegistryLookupFilter[] = [];
  const contractAddress = paymentNodeConfig.tryGetSmartContractAddress(network);
  if (contractAddress) {
    filters.push({ filterSmartContractAddress: contractAddress });
  } else {
    filters.push({ filterPaymentSourceType: "Web3CardanoV2" });
  }
  filters.push({ filterPaymentSourceType: "Web3CardanoV1" });
  return filters;
}
