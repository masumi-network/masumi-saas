"use client";

import { useQuery } from "@tanstack/react-query";

export type CreditBalanceData = {
  creditsRemaining: number;
  updatedAt: string;
};

type CreditBalanceResponse = {
  success?: boolean;
  error?: string;
  data?: CreditBalanceData;
};

export function useCreditBalance() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: async (): Promise<CreditBalanceData> => {
      const response = await fetch("/api/credits");
      const json = (await response.json()) as CreditBalanceResponse;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load credits");
      }

      return json.data;
    },
    // 25s staleTime suppresses duplicate fetches triggered by component
    // re-mounts within a single 30s interval window.
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}
