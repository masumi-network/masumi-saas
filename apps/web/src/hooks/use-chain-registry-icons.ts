"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { x402Fetch } from "@/lib/x402/api";
import type { ChainSearchResult } from "@/lib/x402/chain-registry-types";
import { getEvmChainIconPath } from "@/lib/x402/evm-config";

type ResolveChainsResponse = {
  chains: ChainSearchResult[];
};

export function useChainRegistryIcons(caip2Ids: readonly string[]) {
  const unresolvedIds = useMemo(() => {
    const unique = [
      ...new Set(caip2Ids.map((id) => id.trim()).filter(Boolean)),
    ];
    return unique.filter((caip2Id) => !getEvmChainIconPath(caip2Id));
  }, [caip2Ids]);

  const { data } = useQuery({
    queryKey: ["x402", "chain-registry-icons", unresolvedIds.join("|")],
    queryFn: () =>
      x402Fetch<ResolveChainsResponse>("/chains/resolve", {
        method: "POST",
        body: JSON.stringify({ caip2Ids: unresolvedIds }),
        silentErrors: true,
      }),
    enabled: unresolvedIds.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return useMemo(() => {
    const iconByCaip2Id = new Map<string, string | null>();
    for (const chain of data?.chains ?? []) {
      iconByCaip2Id.set(chain.caip2Id, chain.icon);
    }
    return iconByCaip2Id;
  }, [data?.chains]);
}
