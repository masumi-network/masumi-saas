import prisma from "@masumi/database/client";

import type { PaymentNodeClient } from "@/lib/payment-node";
import {
  createPaymentNodeClient,
  decryptPaymentNodeSecret,
  paymentNodeConfig,
} from "@/lib/payment-node";

/**
 * Returns a payment node client authenticated with the user's API key.
 * Use for registry operations (register, deregister, get registry).
 * Returns null if the user has no payment node key (e.g. signup skipped or failed).
 */
export async function getPaymentNodeClientForUser(
  userId: string,
): Promise<PaymentNodeClient | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { paymentNodeApiKeyEncrypted: true },
  });
  if (!user?.paymentNodeApiKeyEncrypted) return null;
  try {
    const token = await decryptPaymentNodeSecret(
      user.paymentNodeApiKeyEncrypted,
    );
    const baseUrl = paymentNodeConfig.getBaseUrl();
    return createPaymentNodeClient(baseUrl, token);
  } catch (err) {
    console.error(
      "[Payment Node] Failed to decrypt API key for user",
      userId,
      err,
    );
    return null;
  }
}
