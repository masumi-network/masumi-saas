import type { PaymentNodeNetwork } from "@/lib/payment-node";
import type { X402Network } from "@/lib/x402/types";

/**
 * Shared visual accent for the x402 (EVM) rail.
 */
export const X402_ACCENT = {
  badge:
    "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300",
  icon: "text-indigo-600 dark:text-indigo-400",
} as const;

export const X402_ENV_STORAGE_KEY = "masumi_x402_is_testnet";

/** Cardano Preprod/Mainnet — used only for Cardano-scoped features, not x402 env. */
export function isTestnetEnv(network: PaymentNodeNetwork): boolean {
  return network === "Preprod";
}

/** Enabled EVM chains for the active x402 environment (testnet vs mainnet). */
export function chainsForIsTestnet(
  chains: X402Network[],
  isTestnet: boolean,
): X402Network[] {
  return chains.filter(
    (chain) => chain.isEnabled && chain.isTestnet === isTestnet,
  );
}

export function isX402ChainUsable(chain: X402Network): boolean {
  return chain.isEnabled && !!chain.facilitatorWalletId && !!chain.rpcUrl;
}

export function isX402SetUpForIsTestnet(
  chains: X402Network[],
  isTestnet: boolean,
): boolean {
  return chainsForIsTestnet(chains, isTestnet).some(isX402ChainUsable);
}

export function readX402IsTestnetFromStorage(
  fallbackIsTestnet: boolean,
): boolean {
  if (typeof window === "undefined") return fallbackIsTestnet;
  const stored = localStorage.getItem(X402_ENV_STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallbackIsTestnet;
}
