import type { PaymentNodeClient } from "@/lib/payment-node";
import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";

import { isPaymentNodeConfigError } from "./config";

/**
 * Admin payment-node client for SaaS-managed registry operations (register,
 * update). Registry rows are created with the admin key's requestedById.
 */
export function createAdminPaymentNodeClient(): PaymentNodeClient {
  return createPaymentNodeClient(
    paymentNodeConfig.getBaseUrl(),
    paymentNodeConfig.getAdminApiKey(),
  );
}

export function tryCreateAdminPaymentNodeClient(): PaymentNodeClient | null {
  try {
    return createAdminPaymentNodeClient();
  } catch (error) {
    if (isPaymentNodeConfigError(error)) return null;
    throw error;
  }
}
