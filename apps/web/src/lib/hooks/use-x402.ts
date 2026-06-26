"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { getApiKeysAction } from "@/lib/actions/auth.action";
import { useX402Rail } from "@/lib/context/x402-rail-context";
import {
  appendInclusiveCursorPage,
  flattenInclusiveCursorPages,
} from "@/lib/pagination/cursor-pagination";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { x402Fetch } from "@/lib/x402/api";
import type {
  UserApiKeyOption,
  X402Budget,
  X402LowBalanceRule,
  X402Network,
  X402PaymentAttempt,
  X402Wallet,
  X402WalletBalance,
  X402WalletType,
} from "@/lib/x402/types";

const PAGE_SIZE = 20;

export function useUserApiKeys(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: ["user-api-keys"],
    queryFn: async (): Promise<UserApiKeyOption[]> => {
      const result = await getApiKeysAction();
      if (!result.success) throw new Error(result.error);
      return result.keys;
    },
    staleTime: 30_000,
    enabled,
  });

  return {
    apiKeys: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/** @deprecated Use useUserApiKeys */
export function useOrgApiKeys(options?: { enabled?: boolean }) {
  const { apiKeys, isLoading, refetch } = useUserApiKeys(options);
  return {
    orgApiKeys: apiKeys.map((key) => ({
      id: key.id,
      name: key.name ?? "API Key",
      keyPrefix: key.start ?? key.prefix ?? key.id.slice(0, 8),
    })),
    isLoading,
    refetch,
  };
}

const PAGE_SIZE = 20;

function useX402NetworksQuery(options: {
  silentErrors?: boolean;
  isTestnet?: boolean;
  allEnvironments?: boolean;
}) {
  const silentErrors = options.silentErrors ?? false;
  const allEnvironments = options.allEnvironments ?? false;
  const isTestnet = options.isTestnet ?? false;

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

export function useX402Networks(options?: {
  silentErrors?: boolean;
  /** When omitted, uses the x402 rail environment (not Cardano network). */
  isTestnet?: boolean;
  network?: PaymentNodeNetwork;
  allEnvironments?: boolean;
}) {
  const { x402IsTestnet } = useX402Rail();
  const allEnvironments = options?.allEnvironments ?? false;
  const isTestnet =
    options?.isTestnet ??
    (options?.network != null ? options.network === "Preprod" : x402IsTestnet);

  return useX402NetworksQuery({
    silentErrors: options?.silentErrors,
    isTestnet,
    allEnvironments,
  });
}

/** For providers that must not call useX402Rail (avoids circular context). */
export function useX402NetworksAll(options?: { silentErrors?: boolean }) {
  return useX402NetworksQuery({
    silentErrors: options?.silentErrors,
    allEnvironments: true,
  });
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
