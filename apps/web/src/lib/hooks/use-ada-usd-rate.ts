"use client";

import { useQuery } from "@tanstack/react-query";

type RateResponse = {
  cardano?: {
    usd?: number;
  };
};

async function fetchAdaUsdRate(): Promise<number> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd",
  );

  if (!response.ok) {
    throw new Error("Failed to fetch ADA/USD rate");
  }

  const data: RateResponse = await response.json();
  const usdRate = data.cardano?.usd;

  if (
    typeof usdRate !== "number" ||
    !Number.isFinite(usdRate) ||
    usdRate <= 0
  ) {
    throw new Error("Invalid ADA/USD rate data");
  }

  return usdRate;
}

export function useAdaUsdRate() {
  const query = useQuery({
    queryKey: ["ada-usd-rate"],
    queryFn: fetchAdaUsdRate,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
    retry: 1,
  });

  return {
    rate: query.data ?? null,
    isLoading: query.isPending,
    error: query.error,
  };
}
