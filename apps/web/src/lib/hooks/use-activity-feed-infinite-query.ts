import { useInfiniteQuery } from "@tanstack/react-query";

import { ACTIVITY_STALE_CURSOR_CODE } from "@/lib/activity-cursor";
import type { ActivityFeedItem, ActivityTabFilter } from "@/lib/types/activity";

const ACTIVITY_FETCH_LIMIT = 20;

/** Decoded cursor no longer matches the merged feed — reset infinite query (see activity route 410). */
export class StaleCursorError extends Error {
  readonly code = ACTIVITY_STALE_CURSOR_CODE;
  constructor(message: string) {
    super(message);
    this.name = "StaleCursorError";
  }
}

export type ActivityPagePayload = {
  items: ActivityFeedItem[];
  nextCursor: string | null;
};

export function getActivityInfiniteQueryKey(
  filter: ActivityTabFilter,
  network: string,
  refreshKey: number,
) {
  return ["activity", filter, network, refreshKey] as const;
}

export function useActivityFeedInfiniteQuery(
  filter: ActivityTabFilter,
  network: string,
  refreshKey: number,
) {
  return useInfiniteQuery({
    queryKey: getActivityInfiniteQueryKey(filter, network, refreshKey),
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
        code?: string;
        data?: { items?: ActivityFeedItem[]; nextCursor?: string | null };
      };
      if (!json.success) {
        if (
          json.code === ACTIVITY_STALE_CURSOR_CODE &&
          cursor &&
          cursor.length > 0
        ) {
          throw new StaleCursorError(
            json.error ??
              "Activity feed was updated; loading the latest results.",
          );
        }
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
    /** Stale cursor must recover via `resetQueries` in the table — no RQ retries for that error. */
    retry: (failureCount, err) =>
      err instanceof StaleCursorError ? false : failureCount < 3,
    refetchInterval: (query) =>
      query.state.error instanceof StaleCursorError ? false : 25_000,
  });
}
