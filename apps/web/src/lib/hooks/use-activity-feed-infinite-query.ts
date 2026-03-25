import { useInfiniteQuery } from "@tanstack/react-query";

import type { ActivityFeedItem, ActivityTabFilter } from "@/lib/types/activity";

const ACTIVITY_FETCH_LIMIT = 20;

export type ActivityPagePayload = {
  items: ActivityFeedItem[];
  nextCursor: string | null;
};

export function useActivityFeedInfiniteQuery(
  filter: ActivityTabFilter,
  network: string,
  refreshKey: number,
) {
  return useInfiniteQuery({
    queryKey: ["activity", filter, network, refreshKey],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ActivityPagePayload> => {
      const cursor = pageParam as string | undefined;
      const params = new URLSearchParams({
        network,
        limit: String(ACTIVITY_FETCH_LIMIT),
      });
      if (filter !== "all") params.set("filter", filter);
      if (cursor && cursor.length > 0) params.set("cursor", cursor);
      const res = await fetch(`/api/activity?${params.toString()}`);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { items?: ActivityFeedItem[]; nextCursor?: string | null };
      };
      if (!json.success) {
        if (json.error) throw new Error(json.error);
        return { items: [], nextCursor: null };
      }
      return {
        items: (json.data?.items ?? []) as ActivityFeedItem[],
        nextCursor: json.data?.nextCursor ?? null,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor && lastPage.nextCursor.length > 0
        ? lastPage.nextCursor
        : undefined,
    staleTime: 25_000,
    refetchInterval: 25_000,
  });
}
