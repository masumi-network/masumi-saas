"use client";

import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { useX402Networks as useX402NetworksFull } from "./use-x402";
import { usePaymentNodeSupportedX402NetworksQuery } from "./use-x402-supported-networks";

export type X402NetworkOption = {
  id: string;
  caip2Id: string;
  displayName: string;
  isTestnet: boolean;
  isEnabled: boolean;
  defaultAsset: string | null;
  facilitatorWalletAddress: string | null;
};

/** Tenant-configured x402 networks (chains tab, agent sell options, budgets). */
export function useX402Networks(options?: {
  network?: PaymentNodeNetwork;
  silentErrors?: boolean;
  /** When true, only chains with a facilitator wallet assigned (ready to sell on). */
  requireFacilitator?: boolean;
}) {
  const query = useX402NetworksFull({
    network: options?.network,
    silentErrors: options?.silentErrors,
  });

  const networks: X402NetworkOption[] = (query.networks ?? [])
    .filter((network) => network.isEnabled)
    .filter(
      (network) =>
        !options?.requireFacilitator || !!network.facilitatorWalletAddress,
    )
    .map((network) => ({
      id: network.id,
      caip2Id: network.caip2Id,
      displayName: network.displayName,
      isTestnet: network.isTestnet,
      isEnabled: network.isEnabled,
      defaultAsset: network.defaultAsset,
      facilitatorWalletAddress: network.facilitatorWalletAddress,
    }));

  return {
    networks,
    isLoading: query.isLoading,
    error: undefined,
  };
}

/**
 * Chains registered on the payment node — use for add-chain picker (subset of infra).
 */
export function usePaymentNodeSupportedX402Networks(options?: {
  network?: PaymentNodeNetwork;
  silentErrors?: boolean;
  allEnvironments?: boolean;
  facilitatorWalletAddress?: string | null;
}) {
  const query = usePaymentNodeSupportedX402NetworksQuery({
    network: options?.network,
    silentErrors: options?.silentErrors,
    allEnvironments: options?.allEnvironments,
  });

  const facilitatorAddress = options?.facilitatorWalletAddress ?? null;

  const networks: X402NetworkOption[] = (query.networks ?? []).map(
    (network) => ({
      id: network.id,
      caip2Id: network.caip2Id,
      displayName: network.displayName,
      isTestnet: network.isTestnet,
      isEnabled: true,
      defaultAsset: network.defaultAsset,
      facilitatorWalletAddress: facilitatorAddress,
    }),
  );

  return {
    networks,
    isLoading: query.isLoading,
    error: undefined,
  };
}
