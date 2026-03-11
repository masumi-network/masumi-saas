/**
 * Resolve PAYMENT_NODE_PAYMENT_SOURCE_ID to smartContractAddress via payment node API.
 * Used when calling payment/get and purchase/get with filterSmartContractAddress.
 * Cache is per-user to avoid sharing one user's result with others or masking per-user access failures.
 */

import type { PaymentNodeClient } from "@/lib/payment-node/client";
import { paymentNodeConfig } from "@/lib/payment-node/config";

const cacheByUser = new Map<
  string,
  { paymentSourceId: string; address: string }
>();

/**
 * Returns the smart contract address for the configured payment source id.
 * Uses in-memory cache per userId. Call clearSmartContractAddressCache() if the source changes.
 */
export async function getSmartContractAddressForConfiguredSource(
  client: PaymentNodeClient,
  userId: string,
): Promise<string | null> {
  const paymentSourceId = paymentNodeConfig.getPaymentSourceId();
  const entry = cacheByUser.get(userId);
  if (entry?.paymentSourceId === paymentSourceId) return entry.address;

  const maxTake = 100;
  let cursorId: string | undefined;
  for (let page = 0; page < 5; page++) {
    const { PaymentSources } = await client.getPaymentSources({
      take: maxTake,
      cursorId,
    });
    const found = PaymentSources.find((ps) => ps.id === paymentSourceId);
    if (found) {
      cacheByUser.set(userId, {
        paymentSourceId,
        address: found.smartContractAddress,
      });
      return found.smartContractAddress;
    }
    if (PaymentSources.length === 0) break;
    cursorId = PaymentSources[PaymentSources.length - 1]!.id;
  }
  return null;
}

export function clearSmartContractAddressCache(): void {
  cacheByUser.clear();
}
