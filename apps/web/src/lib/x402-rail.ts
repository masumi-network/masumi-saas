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

/** Testnet EVM chains pair with Cardano Preprod; mainnet with Mainnet. */
export function isTestnetEnv(network: PaymentNodeNetwork): boolean {
  return network === "Preprod";
}

/** Enabled EVM chains that belong to the given Cardano environment. */
export function chainsForEnv(
  chains: X402Network[],
  network: PaymentNodeNetwork,
): X402Network[] {
  const wantTestnet = isTestnetEnv(network);
  return chains.filter(
    (chain) => chain.isEnabled && chain.isTestnet === wantTestnet,
  );
}

export function isX402ChainUsable(chain: X402Network): boolean {
  return chain.isEnabled && !!chain.facilitatorWalletId && !!chain.rpcUrl;
}

export function isX402SetUpForEnv(
  chains: X402Network[],
  network: PaymentNodeNetwork,
): boolean {
  return chainsForEnv(chains, network).some(isX402ChainUsable);
}
