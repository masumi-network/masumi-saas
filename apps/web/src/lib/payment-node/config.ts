/**
 * Payment node configuration (server-side only).
 * Base URL and admin API key for wallet/payment-source and creating user API keys.
 */
import type { PaymentNodeNetwork } from "./schemas";

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

function parseWalletAllowlist(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const seen = new Set<string>();
  const wallets: string[] = [];
  for (const entry of value.split(",")) {
    const wallet = entry.trim();
    if (!wallet || seen.has(wallet)) continue;
    seen.add(wallet);
    wallets.push(wallet);
  }
  return wallets;
}

function getRegistrationFundingWallets(network: PaymentNodeNetwork): string[] {
  return parseWalletAllowlist(
    network === "Mainnet"
      ? process.env.PAYMENT_NODE_REGISTRATION_FUNDING_WALLETS_MAINNET
      : process.env.PAYMENT_NODE_REGISTRATION_FUNDING_WALLETS_PREPROD,
  );
}

/**
 * Optional Cardano address of the payment smart contract for the configured source.
 * When set, avoids an extra GET /payment-source round-trip for filters and deregister fallback.
 */
function tryGetPaymentNodeSmartContractAddress(): string | undefined {
  const v = process.env.PAYMENT_NODE_SMART_CONTRACT_ADDRESS?.trim();
  return v && v.length > 0 ? v : undefined;
}

export const paymentNodeConfig = {
  getBaseUrl: getPaymentNodeBaseUrl,
  getAdminApiKey: getPaymentNodeAdminApiKey,
  getPaymentSourceId: getPaymentNodePaymentSourceId,
  getRegistrationFundingWallets,
  tryGetSmartContractAddress: tryGetPaymentNodeSmartContractAddress,
} as const;
