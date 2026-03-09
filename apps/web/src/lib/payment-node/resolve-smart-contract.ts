/**
 * Resolve PAYMENT_NODE_PAYMENT_SOURCE_ID to smartContractAddress via payment node API.
 * Used when calling payment/get and purchase/get with filterSmartContractAddress.
 */

import type { PaymentNodeClient } from "@/lib/payment-node/client";
import { paymentNodeConfig } from "@/lib/payment-node/config";

const CACHE_KEY = "payment_source_smart_contract_address" as const;
let cached: { id: string; address: string } | null = null;

/**
 * Returns the smart contract address for the configured payment source id.
 * Uses in-memory cache. Call clearSmartContractAddressCache() if the source changes.
 */
export async function getSmartContractAddressForConfiguredSource(
  client: PaymentNodeClient,
): Promise<string | null> {
  const paymentSourceId = paymentNodeConfig.getPaymentSourceId();
  if (cached?.id === paymentSourceId) return cached.address;

  const maxTake = 100;
  let cursorId: string | undefined;
  for (let page = 0; page < 5; page++) {
    const { PaymentSources } = await client.getPaymentSources({
      take: maxTake,
      cursorId,
    });
    const found = PaymentSources.find((ps) => ps.id === paymentSourceId);
    if (found) {
      cached = { id: paymentSourceId, address: found.smartContractAddress };
      return found.smartContractAddress;
    }
    if (PaymentSources.length === 0) break;
    cursorId = PaymentSources[PaymentSources.length - 1]!.id;
  }
  return null;
}

export function clearSmartContractAddressCache(): void {
  cached = null;
}
