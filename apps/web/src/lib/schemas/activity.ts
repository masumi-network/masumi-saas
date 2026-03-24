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
});

export type ActivityQueryInput = z.infer<typeof activityQueryInputSchema>;

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
