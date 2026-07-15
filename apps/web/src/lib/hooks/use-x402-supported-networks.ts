"use client";

import { useQuery } from "@tanstack/react-query";

import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { x402Fetch } from "@/lib/x402/api";
import { isTestnetEnv } from "@/lib/x402-rail";

export type PaymentNodeSupportedX402Network = {
  id: string;
  caip2Id: string;
  displayName: string;
  rpcUrl: string;
  isTestnet: boolean;
  defaultAsset: string | null;
};

export function usePaymentNodeSupportedX402NetworksQuery(options?: {
  network?: PaymentNodeNetwork;
  silentErrors?: boolean;
  allEnvironments?: boolean;
}) {
  const { network: contextNetwork } = usePaymentNetwork();
  const network = options?.network ?? contextNetwork;
  const silentErrors = options?.silentErrors ?? false;
  const allEnvironments = options?.allEnvironments ?? false;
  const isTestnet = isTestnetEnv(network);

  const query = useQuery({
    queryKey: [
      "x402",
      "networks",
      "supported",
      silentErrors,
      allEnvironments ? "all" : isTestnet,
    ],
    queryFn: async (): Promise<PaymentNodeSupportedX402Network[]> => {
      const params = new URLSearchParams();
      if (!allEnvironments) {
        params.set("isTestnet", isTestnet ? "true" : "false");
      }
      const suffix = params.size > 0 ? `?${params}` : "";
      const json = await x402Fetch<{
        Networks: PaymentNodeSupportedX402Network[];
      }>(`/networks/supported${suffix}`, { silentErrors });
      return json.Networks ?? [];
    },
    staleTime: 60_000,
    retry: silentErrors ? false : 3,
  });

  return {
    networks: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
