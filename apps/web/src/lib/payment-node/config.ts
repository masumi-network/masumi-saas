/**
 * Payment node configuration (server-side only).
 * Base URL and admin API key for wallet/payment-source and creating user API keys.
 */
function getPaymentNodeBaseUrl(): string {
  const url = process.env.PAYMENT_NODE_BASE_URL;
  if (!url?.trim()) {
    throw new Error(
      "PAYMENT_NODE_BASE_URL is required for payment node integration",
    );
  }
  return url.replace(/\/$/, "");
}

function getPaymentNodeAdminApiKey(): string {
  const key = process.env.PAYMENT_NODE_ADMIN_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      "PAYMENT_NODE_ADMIN_API_KEY is required for admin operations (add wallets, create user API keys)",
    );
  }
  return key;
}

/** Payment source id (single shared source for all users). Required for PATCH add-wallets. */
function getPaymentNodePaymentSourceId(): string {
  const id = process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID;
  if (!id?.trim()) {
    throw new Error(
      "PAYMENT_NODE_PAYMENT_SOURCE_ID is required for adding agent wallets",
    );
  }
  return id;
}

export const paymentNodeConfig = {
  getBaseUrl: getPaymentNodeBaseUrl,
  getAdminApiKey: getPaymentNodeAdminApiKey,
  getPaymentSourceId: getPaymentNodePaymentSourceId,
} as const;
