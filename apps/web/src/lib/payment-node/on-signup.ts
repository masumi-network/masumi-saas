import prisma from "@masumi/database/client";

import {
  createPaymentNodeClient,
  encryptPaymentNodeSecret,
  paymentNodeConfig,
} from "@/lib/payment-node";

/**
 * Create a payment node API key for the user and store it encrypted.
 * Call this after signup (user already created). If payment node is not
 * configured or the request fails, we leave paymentNodeApiKeyEncrypted null
 * and log; signup still succeeds.
 */
export async function createPaymentNodeKeyForUser(
  userId: string,
): Promise<void> {
  let baseUrl: string;
  let adminKey: string;
  try {
    baseUrl = paymentNodeConfig.getBaseUrl();
    adminKey = paymentNodeConfig.getAdminApiKey();
  } catch {
    // Payment node not configured (e.g. dev without .env)
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Payment Node] Skipping API key creation: PAYMENT_NODE_BASE_URL or PAYMENT_NODE_ADMIN_API_KEY not set",
      );
    }
    return;
  }

  try {
    const adminClient = createPaymentNodeClient(baseUrl, adminKey);
    const result = await adminClient.createApiKey({
      permission: "ReadAndPay",
      networkLimit: ["Preprod", "Mainnet"],
      usageLimited: false,
      UsageCredits: [], // Limits can be added later
    });

    const encrypted = await encryptPaymentNodeSecret(result.token);
    await prisma.user.update({
      where: { id: userId },
      data: { paymentNodeApiKeyEncrypted: encrypted },
    });
  } catch (error) {
    // Missing PAYMENT_NODE_ENCRYPTION_KEY or payment node error – don't fail signup
    console.error(
      "[Payment Node] Failed to create API key for user",
      userId,
      error,
    );
  }
}
