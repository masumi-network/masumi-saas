/**
 * Resolve smart contract address for the configured payment source:
 * 1) PAYMENT_NODE_SMART_CONTRACT_ADDRESS when set
 * 2) Else PAYMENT_NODE_PAYMENT_SOURCE_ID via GET /payment-source (cached per user)
 *
 * Used for payment/purchase filters and deregister fallback.
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
  const fromEnv = paymentNodeConfig.tryGetSmartContractAddress();
  if (fromEnv) return fromEnv;

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
