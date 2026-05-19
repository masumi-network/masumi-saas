import { createRoute } from "@hono/zod-openapi";

import {
  ACTIVITY_STALE_CURSOR_CODE,
  decodeActivityCursor,
  encodeActivityCursor,
} from "@/lib/activity-cursor";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import {
  activityPaginationFromLimitParamSchema,
  activityQueryInputSchema,
  parseActivityQueryInput,
} from "@/lib/schemas/activity";
import {
  activitySuccessSchema,
  errBody,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";
import type { ActivityFeedItem } from "@/lib/types/activity";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

import {
  ACTIVITY_MERGED_FEED_LIMIT,
  getActivityMergedFeedCached,
} from "./build-merged-feed";

export type { ActivityFeedFilter as FeedFilter } from "@/lib/schemas/activity";
export type { ActivityFeedItem };

const staleCursorErrorSchema = z.object({
  success: z.literal(false),
  code: z.literal(ACTIVITY_STALE_CURSOR_CODE),
  error: z.string(),
});

const app = createApiApp("/api/activity");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Activity"],
    summary: "Activity feed",
    description:
      "Cross-agent activity with filters (tab/type). Use `summary=1` for counts-only payload.",
    security,
    request: {
      query: activityQueryInputSchema,
    },
    responses: {
      200: {
        description: "Activity feed or summary",
        content: { "application/json": { schema: activitySuccessSchema } },
      },
      410: {
        description: "Stale cursor",
        content: { "application/json": { schema: staleCursorErrorSchema } },
      },
      503: {
        description: "Payment node unavailable",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    try {
      const qp = c.req.valid("query");
      const { limit: limitRaw, cursor: cursorParam, ...queryRaw } = qp;
      const query = parseActivityQueryInput(queryRaw);
      const validFilter = query.filter;
      const network = query.network;
      requireNetworkedOidcApiScope(authContext, {
        resource: "activity",
        action: "read",
        network,
      });

      const { merged, transactionLastUpdate } =
        await getActivityMergedFeedCached({
          userId: authContext.user.id,
          network,
          validFilter,
          lastUpdate: query.lastUpdate,
        });

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
        return c.json({ success: true as const, data }, 200);
      }

      const paginationResult =
        activityPaginationFromLimitParamSchema.safeParse(limitRaw);
      if (!paginationResult.success) {
        throw new ApiError(
          400,
          paginationResult.error.issues.map((i) => i.message).join("; "),
        );
      }
      const pagination = paginationResult.data;

      if (!pagination.usePagination) {
        const items = merged.slice(0, ACTIVITY_MERGED_FEED_LIMIT);
        const data: { items: ActivityFeedItem[]; lastUpdate?: string } = {
          items,
        };
        if (validFilter === "transactions" && transactionLastUpdate)
          data.lastUpdate = transactionLastUpdate;
        return c.json({ success: true as const, data }, 200);
      }

      const { pageLimit } = pagination;
      let start = 0;
      if (cursorParam) {
        const cur = decodeActivityCursor(cursorParam);
        if (cur) {
          const idx = merged.findIndex(
            (it: ActivityFeedItem) =>
              it.date === cur.d && it.kind === cur.k && it.id === cur.i,
          );
          if (idx < 0) {
            throw new ApiError(
              410,
              "This page of the activity feed is out of date. Refresh to load the latest items.",
              { extraBody: { code: ACTIVITY_STALE_CURSOR_CODE } },
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
      return c.json({ success: true as const, data }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to get activity feed:", error);
      const message =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "Failed to load activity";
      throw new ApiError(500, message);
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
