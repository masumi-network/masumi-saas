"use client";

import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { useX402Networks as useX402NetworksFull } from "./use-x402";

export type X402NetworkOption = {
  id: string;
  caip2Id: string;
  displayName: string;
  isTestnet: boolean;
  isEnabled: boolean;
  defaultAsset: string | null;
  facilitatorWalletAddress: string | null;
};

export function useX402Networks(options?: {
  network?: PaymentNodeNetwork;
  silentErrors?: boolean;
}) {
  const query = useX402NetworksFull({
    network: options?.network,
    silentErrors: options?.silentErrors,
  });

  const networks: X402NetworkOption[] = (query.networks ?? [])
    .filter((network) => network.isEnabled)
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
