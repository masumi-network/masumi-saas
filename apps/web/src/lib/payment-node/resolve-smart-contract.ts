/**
 * Resolve smart contract address for the configured payment source:
 * 1) PAYMENT_NODE_SMART_CONTRACT_ADDRESS_{NETWORK} when set
 * 2) Else PAYMENT_NODE_PAYMENT_SOURCE_ID_{NETWORK} via GET /payment-source
 *
 * Used for payment/purchase filters and deregister fallback.
 */

import type { PaymentNodeClient } from "@/lib/payment-node/client";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import type { PaymentNodeNetwork } from "@/lib/payment-node/schemas";

const cacheByUser = new Map<
  string,
  { paymentSourceId: string; address: string }
>();

/**
 * Returns the smart contract address for the configured payment source id.
 * Uses in-memory cache per userId + network + paymentSourceId.
 */
export async function getSmartContractAddressForConfiguredSource(
  client: PaymentNodeClient,
  userId: string,
  network: PaymentNodeNetwork,
): Promise<string | null> {
  const fromEnv = paymentNodeConfig.tryGetSmartContractAddress(network);
  if (fromEnv) return fromEnv;

  const paymentSourceId = paymentNodeConfig.getPaymentSourceId(network);
  const cacheKey = `${userId}:${network}:${paymentSourceId}`;
  const entry = cacheByUser.get(cacheKey);
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
      cacheByUser.set(cacheKey, {
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
