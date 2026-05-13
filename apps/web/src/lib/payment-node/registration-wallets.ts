import type { PaymentNodeNetwork, PaymentSourceWallet } from "./client";
import { paymentNodeConfig } from "./config";

export function isWalletAddressCompatibleWithNetwork(
  address: string,
  network: PaymentNodeNetwork,
): boolean {
  if (network === "Preprod") return address.startsWith("addr_test");
  if (network === "Mainnet") return address.startsWith("addr1");
  return true;
}

export function resolveRegistrationFundingWallet(params: {
  network: PaymentNodeNetwork;
  paymentSourceId: string;
  sellingWallets: PaymentSourceWallet[];
}): { wallet: PaymentSourceWallet | null; error?: string } {
  const configuredWallets = paymentNodeConfig.getRegistrationFundingWallets(
    params.network,
  );
  if (configuredWallets.length === 0) {
    const envName =
      params.network === "Mainnet"
        ? "PAYMENT_NODE_REGISTRATION_FUNDING_WALLETS_MAINNET"
        : "PAYMENT_NODE_REGISTRATION_FUNDING_WALLETS_PREPROD";
    return {
      wallet: null,
      error: `No registration funding wallets are configured for ${params.network}. Set ${envName} to one or more existing selling wallet addresses on payment source ${params.paymentSourceId}.`,
    };
  }

  const matchedWallets = configuredWallets
    .map((address) =>
      params.sellingWallets.find(
        (candidate) => candidate.walletAddress === address,
      ),
    )
    .filter((wallet): wallet is PaymentSourceWallet => wallet != null);

  if (matchedWallets.length > 0) {
    const selectedIndex = Math.floor(Math.random() * matchedWallets.length);
    return { wallet: matchedWallets[selectedIndex] ?? null };
  }

  return {
    wallet: null,
    error: `None of the configured registration funding wallets matched a managed selling wallet on payment source ${params.paymentSourceId} for ${params.network}.`,
  };
}
