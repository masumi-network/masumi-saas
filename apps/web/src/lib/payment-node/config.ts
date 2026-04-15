/**
 * Payment node configuration (server-side only).
 * Base URL and admin API key for wallet/payment-source and creating user API keys.
 */
import type { PaymentNodeNetwork } from "./schemas";

export class PaymentNodeConfigError extends Error {
  readonly envName?: string;

  constructor(message: string, options?: { envName?: string }) {
    super(message);
    this.name = "PaymentNodeConfigError";
    this.envName = options?.envName;
  }
}

export function isPaymentNodeConfigError(
  error: unknown,
): error is PaymentNodeConfigError {
  return error instanceof PaymentNodeConfigError;
}

function getPaymentSourceIdEnvName(
  network: PaymentNodeNetwork,
):
  | "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET"
  | "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD" {
  return network === "Mainnet"
    ? "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET"
    : "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD";
}

function getSmartContractAddressEnvName(
  network: PaymentNodeNetwork,
):
  | "PAYMENT_NODE_SMART_CONTRACT_ADDRESS_MAINNET"
  | "PAYMENT_NODE_SMART_CONTRACT_ADDRESS_PREPROD" {
  return network === "Mainnet"
    ? "PAYMENT_NODE_SMART_CONTRACT_ADDRESS_MAINNET"
    : "PAYMENT_NODE_SMART_CONTRACT_ADDRESS_PREPROD";
}

function getPaymentNodeBaseUrl(): string {
  const url = process.env.PAYMENT_NODE_BASE_URL;
  if (!url?.trim()) {
    throw new PaymentNodeConfigError(
      "PAYMENT_NODE_BASE_URL is required for payment node integration",
      { envName: "PAYMENT_NODE_BASE_URL" },
    );
  }
  return url.replace(/\/$/, "");
}

function getPaymentNodeAdminApiKey(): string {
  const key = process.env.PAYMENT_NODE_ADMIN_API_KEY;
  if (!key?.trim()) {
    throw new PaymentNodeConfigError(
      "PAYMENT_NODE_ADMIN_API_KEY is required for admin operations (add wallets, create user API keys)",
      { envName: "PAYMENT_NODE_ADMIN_API_KEY" },
    );
  }
  return key;
}

/** Payment source id (network-specific shared source for all users). Required for PATCH add-wallets. */
function getPaymentNodePaymentSourceId(network: PaymentNodeNetwork): string {
  const envName = getPaymentSourceIdEnvName(network);
  const id = process.env[envName];
  if (!id?.trim()) {
    throw new PaymentNodeConfigError(
      `${envName} is required for ${network} payment-source operations`,
      { envName },
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
function tryGetPaymentNodeSmartContractAddress(
  network: PaymentNodeNetwork,
): string | undefined {
  const v = process.env[getSmartContractAddressEnvName(network)]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export const paymentNodeConfig = {
  getBaseUrl: getPaymentNodeBaseUrl,
  getAdminApiKey: getPaymentNodeAdminApiKey,
  getPaymentSourceIdEnvName,
  getPaymentSourceId: getPaymentNodePaymentSourceId,
  getRegistrationFundingWallets,
  getSmartContractAddressEnvName,
  tryGetSmartContractAddress: tryGetPaymentNodeSmartContractAddress,
} as const;
