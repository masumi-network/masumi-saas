import { zfd } from "zod-form-data";

import { z } from "@/lib/zod-openapi";

import { type NetworkQuery, parseNetwork } from "./api-query";

export const activityFeedFilterSchema = z.enum([
  "all",
  "lifecycle",
  "transactions",
  "purchases",
  "payments",
  "refundRequests",
  "disputes",
]);

export type ActivityFeedFilter = z.infer<typeof activityFeedFilterSchema>;

/** Activity feed page size when `limit` is present (clamped). */
export const ACTIVITY_PAGE_SIZE_MIN = 1;
export const ACTIVITY_PAGE_SIZE_MAX = 50;
export const ACTIVITY_PAGE_SIZE_DEFAULT = 20;

export type ActivityPaginationFromLimit =
  | { usePagination: false }
  | { usePagination: true; pageLimit: number };

/**
 * Raw `limit` query value (from {@link activityApiSearchParamsSchema}): absent/empty → first chunk
 * without cursor pagination; otherwise integer clamped to [{@link ACTIVITY_PAGE_SIZE_MIN},
 * {@link ACTIVITY_PAGE_SIZE_MAX}], with non-numeric values using {@link ACTIVITY_PAGE_SIZE_DEFAULT}.
 */
export const activityPaginationFromLimitParamSchema = z
  .union([z.undefined(), z.string()])
  .transform((raw): ActivityPaginationFromLimit => {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s === "") {
      return { usePagination: false };
    }
    const parsed = Number.parseInt(s, 10);
    const n = Number.isNaN(parsed)
      ? ACTIVITY_PAGE_SIZE_DEFAULT
      : Math.min(
          ACTIVITY_PAGE_SIZE_MAX,
          Math.max(ACTIVITY_PAGE_SIZE_MIN, parsed),
        );
    return { usePagination: true, pageLimit: n };
  });

/**
 * GET /api/activity query (raw strings from URL). No `.catch` / `.transform` here so
 * zod-to-openapi can emit parameters; coercion lives in {@link parseActivityQueryInput}.
 */
export const activityQueryInputSchema = z.object({
  filter: z.string().optional().openapi({
    description:
      'Tab: all | lifecycle | transactions | purchases | payments | refundRequests | disputes. Unknown or missing → "all".',
    example: "all",
  }),
  network: z.string().optional().nullable().openapi({
    description:
      "Prefer Mainnet or Preprod; invalid or missing values default to Preprod (same as `parseNetwork`).",
    example: "Preprod",
  }),
  summary: z.string().optional().openapi({
    description:
      'Set to "1" for summary counts (`totalTransactions`, `totalActivity`) instead of `items`.',
    example: "1",
  }),
  lastUpdate: z.string().optional().openapi({
    description:
      "ISO timestamp for incremental sync; invalid or empty values are ignored.",
  }),
  limit: z.string().optional().openapi({
    description:
      "Page size when paginating with `cursor`. If omitted or empty, returns the first chunk (server max). When set: integer clamped between 1 and 50; non-numeric values default to 20.",
    example: "20",
  }),
  cursor: z.string().optional().openapi({
    description:
      "Opaque cursor from the previous response (`nextCursor`). A stale cursor yields HTTP 410.",
  }),
});

export type ActivityQueryInput = z.infer<typeof activityQueryInputSchema>;

/**
 * Parses `URLSearchParams` for GET /api/activity (`zod-form-data` accepts iterables of entries).
 * Empty query values become `undefined` via {@link zfd.text}. Fields match {@link activityQueryInputSchema}
 * (including `limit` and `cursor` for pagination).
 */
export const activityApiSearchParamsSchema = zfd.formData(
  z.object({
    filter: zfd.text(z.string().optional()),
    network: zfd.text(z.string().optional()),
    summary: zfd.text(z.string().optional()),
    lastUpdate: zfd.text(z.string().optional()),
    limit: zfd.text(z.string().optional()),
    cursor: zfd.text(z.string().optional()),
  }),
);

export type ParsedActivityQuery = {
  filter: ActivityFeedFilter;
  network: NetworkQuery;
  summary: boolean;
  lastUpdate: string | undefined;
};

/** Normalizes URL query into typed values (invalid `filter` → `all`, etc.). */
export function parseActivityQueryInput(
  raw: ActivityQueryInput,
): ParsedActivityQuery {
  const filterRaw = raw.filter?.trim() || "all";
  const filterTry = activityFeedFilterSchema.safeParse(filterRaw);
  const filter = filterTry.success ? filterTry.data : "all";

  const network = parseNetwork(raw.network ?? undefined);

  const summary = raw.summary === "1";

  let lastUpdate: string | undefined;
  if (raw.lastUpdate?.trim()) {
    const d = new Date(raw.lastUpdate);
    if (!Number.isNaN(d.getTime())) lastUpdate = d.toISOString();
  }

  return { filter, network, summary, lastUpdate };
}
