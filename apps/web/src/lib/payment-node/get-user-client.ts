import prisma from "@masumi/database/client";

import type { PaymentNodeClient } from "@/lib/payment-node";
import {
  createPaymentNodeClient,
  decryptPaymentNodeSecret,
  paymentNodeConfig,
} from "@/lib/payment-node";
import { createPaymentNodeKeyForUser } from "@/lib/payment-node/on-signup";

/**
 * Returns the decrypted payment node API key token for a user (lazy-provisions if missing).
 * Use when you only need the token (e.g. proxy header) instead of a full client.
 */
export async function getPaymentNodeApiKeyTokenForUser(
  userId: string,
): Promise<string | null> {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { paymentNodeApiKeyEncrypted: true },
  });

  // Lazy provisioning for OAuth users who signed up before this key existed.
  if (!user?.paymentNodeApiKeyEncrypted) {
    await createPaymentNodeKeyForUser(userId);
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { paymentNodeApiKeyEncrypted: true },
    });
  }

  if (!user?.paymentNodeApiKeyEncrypted) return null;
  try {
    return await decryptPaymentNodeSecret(user.paymentNodeApiKeyEncrypted);
  } catch (err) {
    console.error(
      "[Payment Node] Failed to decrypt API key for user",
      userId,
      err,
    );
    return null;
  }
}

/**
 * Returns a payment node client authenticated with the user's API key.
 * Use for registry operations (register, deregister, get registry).
 * Returns null if the user has no payment node key and provisioning fails.
 */
export async function getPaymentNodeClientForUser(
  userId: string,
): Promise<PaymentNodeClient | null> {
  const token = await getPaymentNodeApiKeyTokenForUser(userId);
  if (!token) return null;
  try {
    const baseUrl = paymentNodeConfig.getBaseUrl();
    return createPaymentNodeClient(baseUrl, token);
  } catch (err) {
    console.error(
      "[Payment Node] Failed to build client for user",
      userId,
      err,
    );
    return null;
  }
}
