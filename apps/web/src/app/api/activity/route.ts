import { NextRequest, NextResponse } from "next/server";

import {
  ACTIVITY_STALE_CURSOR_CODE,
  decodeActivityCursor,
  encodeActivityCursor,
} from "@/lib/activity-cursor";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  activityQueryInputSchema,
  parseActivityQueryInput,
} from "@/lib/schemas/activity";
import type { ActivityFeedItem } from "@/lib/types/activity";

import {
  ACTIVITY_MERGED_FEED_LIMIT,
  getActivityMergedFeedCached,
} from "./build-merged-feed";

export type { ActivityFeedFilter as FeedFilter } from "@/lib/schemas/activity";
export type { ActivityFeedItem };

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { searchParams } = request.nextUrl;
    const queryRaw = activityQueryInputSchema.parse({
      filter: searchParams.get("filter") ?? undefined,
      network: searchParams.get("network"),
      summary: searchParams.get("summary") ?? undefined,
      lastUpdate: searchParams.get("lastUpdate") ?? undefined,
    });
    const query = parseActivityQueryInput(queryRaw);
    const validFilter = query.filter;
    const network = query.network;

    const { merged, transactionLastUpdate } = await getActivityMergedFeedCached(
      {
        userId: user.id,
        network,
        validFilter,
        lastUpdate: query.lastUpdate,
      },
    );

    const summary = query.summary === true;
    if (summary) {
      const totalTransactions = merged.filter(
        (i: ActivityFeedItem) => i.kind === "transaction",
      ).length;
      const data: {
        totalTransactions: number;
        totalActivity: number;
        lastUpdate?: string;
      } = {
        totalTransactions,
        totalActivity: merged.length,
      };
      if (transactionLastUpdate) data.lastUpdate = transactionLastUpdate;
      return NextResponse.json({
        success: true,
        data,
      });
    }

    const limitRaw = searchParams.get("limit");
    const usePagination = limitRaw != null && limitRaw !== "";

    if (!usePagination) {
      const items = merged.slice(0, ACTIVITY_MERGED_FEED_LIMIT);
      const data: { items: ActivityFeedItem[]; lastUpdate?: string } = {
        items,
      };
      if (validFilter === "transactions" && transactionLastUpdate)
        data.lastUpdate = transactionLastUpdate;
      return NextResponse.json({
        success: true,
        data,
      });
    }

    const pageLimit = Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 20));
    const cursorParam = searchParams.get("cursor");
    let start = 0;
    if (cursorParam) {
      const c = decodeActivityCursor(cursorParam);
      if (c) {
        const idx = merged.findIndex(
          (it: ActivityFeedItem) =>
            it.date === c.d && it.kind === c.k && it.id === c.i,
        );
        if (idx < 0) {
          return NextResponse.json(
            {
              success: false,
              code: ACTIVITY_STALE_CURSOR_CODE,
              error:
                "This page of the activity feed is out of date. Refresh to load the latest items.",
            },
            { status: 410 },
          );
        }
        start = idx + 1;
      }
    }

    const pageItems = merged.slice(start, start + pageLimit);
    const nextCursor =
      pageItems.length === pageLimit && start + pageLimit < merged.length
        ? encodeActivityCursor(pageItems[pageItems.length - 1]!)
        : null;

    const data: {
      items: ActivityFeedItem[];
      nextCursor: string | null;
      lastUpdate?: string;
    } = {
      items: pageItems,
      nextCursor,
    };
    if (validFilter === "transactions" && transactionLastUpdate)
      data.lastUpdate = transactionLastUpdate;
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get activity feed:", error);
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Failed to load activity";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
