"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { getOrgApiKeysAction } from "@/lib/actions/org-api-keys.action";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import {
  appendInclusiveCursorPage,
  flattenInclusiveCursorPages,
} from "@/lib/pagination/cursor-pagination";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { x402Fetch } from "@/lib/x402/api";
import type {
  OrgApiKeyOption,
  X402Budget,
  X402LowBalanceRule,
  X402Network,
  X402PaymentAttempt,
  X402Wallet,
  X402WalletBalance,
  X402WalletType,
} from "@/lib/x402/types";
import { isTestnetEnv } from "@/lib/x402-rail";

const PAGE_SIZE = 20;

export function useOrgApiKeys(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: ["org-api-keys"],
    queryFn: async (): Promise<OrgApiKeyOption[]> => {
      const result = await getOrgApiKeysAction();
      if (!result.success) throw new Error(result.error);
      return result.keys;
    },
    staleTime: 30_000,
    enabled,
  });

  return {
    orgApiKeys: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useX402Networks(options?: {
  silentErrors?: boolean;
  network?: PaymentNodeNetwork;
  allEnvironments?: boolean;
}) {
  const { network: activeNetwork } = usePaymentNetwork();
  const silentErrors = options?.silentErrors ?? false;
  const network = options?.network ?? activeNetwork;
  const isTestnet = isTestnetEnv(network);
  const allEnvironments = options?.allEnvironments ?? false;

  const query = useQuery({
    queryKey: [
      "x402",
      "networks",
      silentErrors,
      allEnvironments ? "all" : isTestnet,
    ],
    queryFn: async (): Promise<X402Network[]> => {
      const params = new URLSearchParams();
      if (!allEnvironments) {
        params.set("isTestnet", isTestnet ? "true" : "false");
      }
      const suffix = params.size > 0 ? `?${params}` : "";
      const json = await x402Fetch<{ Networks: X402Network[] }>(
        `/networks${suffix}`,
        { silentErrors },
      );
      return json.Networks ?? [];
    },
    staleTime: 30_000,
    retry: silentErrors ? false : 3,
  });

  return {
    networks: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export function useX402Wallets(enabled = true, type?: X402WalletType) {
  const query = useQuery({
    queryKey: ["x402", "wallets", "all", type ?? "any"],
    queryFn: async (): Promise<X402Wallet[]> => {
      let items: X402Wallet[] = [];
      let cursor: string | undefined;
      while (true) {
        const params = new URLSearchParams({
          take: String(PAGE_SIZE),
        });
        if (cursor) params.set("cursorId", cursor);
        if (type) params.set("type", type);
        const json = await x402Fetch<{ Wallets: X402Wallet[] }>(
          `/wallets?${params}`,
        );
        const page = json.Wallets ?? [];
        if (page.length === 0) break;
        items = appendInclusiveCursorPage(items, page, (wallet) => wallet.id);
        if (page.length < PAGE_SIZE) break;
        const last = page[page.length - 1];
        if (!last?.id || last.id === cursor) break;
        cursor = last.id;
      }
      return items;
    },
    enabled,
    staleTime: 30_000,
  });

  return {
    wallets: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export function useX402WalletsPaginated() {
  const query = useInfiniteQuery({
    queryKey: ["x402", "wallets", "paginated"],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ take: String(PAGE_SIZE) });
      if (pageParam) params.set("cursorId", pageParam);
      const json = await x402Fetch<{ Wallets: X402Wallet[] }>(
        `/wallets?${params}`,
      );
      const wallets = json.Wallets ?? [];
      const hasMore = wallets.length === PAGE_SIZE;
      const nextCursor = hasMore
        ? (wallets[wallets.length - 1]?.id ?? undefined)
        : undefined;
      return { wallets, nextCursor, hasMore };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
  });

  const wallets = useMemo(
    () =>
      flattenInclusiveCursorPages(
        (query.data?.pages ?? []).map((page) => page.wallets),
        (wallet) => wallet.id,
      ),
    [query.data],
  );

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query]);

  return {
    wallets,
    isLoading: query.isLoading,
    hasMore: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore,
    isRefetching: query.isRefetching,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export function useX402Budgets(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: ["x402", "budgets"],
    queryFn: async (): Promise<X402Budget[]> => {
      const json = await x402Fetch<{ Budgets: X402Budget[] }>("/budgets");
      return json.Budgets ?? [];
    },
    staleTime: 30_000,
    enabled,
  });

  return {
    budgets: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export function useX402LowBalanceRules(includeDisabled = true) {
  const query = useQuery({
    queryKey: ["x402", "low-balance", includeDisabled],
    queryFn: async (): Promise<X402LowBalanceRule[]> => {
      const params = new URLSearchParams({
        includeDisabled: includeDisabled ? "true" : "false",
      });
      const json = await x402Fetch<{ Rules: X402LowBalanceRule[] }>(
        `/low-balance?${params}`,
      );
      return json.Rules ?? [];
    },
    staleTime: 30_000,
    retry: false,
  });

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export type X402PaymentFilters = {
  status?: X402PaymentAttempt["status"];
  direction?: X402PaymentAttempt["direction"];
  caip2Network?: string;
};

export function useX402PaymentAttempts(filters: X402PaymentFilters = {}) {
  const query = useInfiniteQuery({
    queryKey: [
      "x402",
      "payments",
      filters.status ?? null,
      filters.direction ?? null,
      filters.caip2Network ?? null,
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ take: String(PAGE_SIZE) });
      if (pageParam) params.set("cursorId", pageParam);
      if (filters.status) params.set("status", filters.status);
      if (filters.direction) params.set("direction", filters.direction);
      if (filters.caip2Network) {
        params.set("caip2Network", filters.caip2Network);
      }
      const json = await x402Fetch<{ PaymentAttempts: X402PaymentAttempt[] }>(
        `/payments?${params}`,
      );
      const attempts = json.PaymentAttempts ?? [];
      const hasMore = attempts.length === PAGE_SIZE;
      const nextCursor = hasMore
        ? (attempts[attempts.length - 1]?.id ?? undefined)
        : undefined;
      return { attempts, nextCursor, hasMore };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 15_000,
  });

  const attempts = useMemo(
    () =>
      flattenInclusiveCursorPages(
        (query.data?.pages ?? []).map((page) => page.attempts),
        (attempt) => attempt.id,
      ),
    [query.data],
  );

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query]);

  return {
    attempts,
    isLoading: query.isLoading,
    hasMore: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore,
    refetch: async () => {
      await query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}

export function useX402WalletBalances(walletId: string | null, open: boolean) {
  return useQuery({
    queryKey: ["x402", "wallet-balance", walletId],
    queryFn: async (): Promise<X402WalletBalance[]> => {
      const json = await x402Fetch<{ Balances: X402WalletBalance[] }>(
        `/wallets/balance?id=${walletId}`,
      );
      const balances = json.Balances;
      if (balances == null) throw new Error("Failed to read balances");
      return balances;
    },
    enabled: open && !!walletId,
    staleTime: 15_000,
    retry: false,
  });
}
