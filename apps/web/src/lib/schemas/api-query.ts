/**
 * Shared Zod schemas for API route query parameters.
 * Used across authenticated and public API routes for consistent validation.
 * These are also reused by OpenAPI generation, so they must come from the
 * shared extended Zod instance in `lib/zod-openapi`.
 */

import { z } from "@/lib/zod-openapi";

/** Payment node network: Mainnet | Preprod. Default Preprod when invalid/missing. */
export const networkQuerySchema = z
  .enum(["Mainnet", "Preprod"])
  .catch("Preprod");
export type NetworkQuery = z.infer<typeof networkQuerySchema>;

/** Parse a raw network string (e.g. from query or cookie). Returns "Preprod" if invalid. */
export function parseNetwork(value: string | null | undefined): NetworkQuery {
  return networkQuerySchema.parse(value ?? "Preprod");
}

/** Earnings overview period (GET /api/earnings). */
const earningsPeriodEnum = z.enum(["24h", "7d", "30d", "all"]);
export const earningsPeriodSchema = earningsPeriodEnum.default("7d");
export type EarningsPeriod = z.infer<typeof earningsPeriodSchema>;

/** Agent earnings period (GET /api/agents/[agentId]/earnings). */
const agentEarningsPeriodEnum = z.enum(["1d", "7d", "30d", "all"]);
export const agentEarningsPeriodSchema = agentEarningsPeriodEnum.default("7d");
export type AgentEarningsPeriod = z.infer<typeof agentEarningsPeriodSchema>;

const agentAnalyticsRangeEnum = z.enum(["7d", "30d", "90d", "all", "custom"]);
export const agentAnalyticsRangeSchema = agentAnalyticsRangeEnum.default("30d");
export type AgentAnalyticsRange = z.infer<typeof agentAnalyticsRangeSchema>;

const ymdDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "Time zone is required")
  .max(100, "Time zone is invalid")
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Time zone must be a valid IANA time zone");

/** GET /api/earnings query. */
export const earningsQuerySchema = z.object({
  period: z.string().optional().default("7d").pipe(earningsPeriodEnum),
  network: z
    .string()
    .optional()
    .nullable()
    .transform((v) => parseNetwork(v)),
});

/** GET /api/agents/[agentId]/earnings query. */
export const agentEarningsQuerySchema = z.object({
  period: z.string().optional().default("7d").pipe(agentEarningsPeriodEnum),
});

/** GET /api/earnings/agent query. */
export const agentAnalyticsQuerySchema = z
  .object({
    agentId: z.preprocess(
      (value) =>
        value === null || value === undefined || value === ""
          ? undefined
          : String(value).trim(),
      z.string().min(1, "Agent ID is required"),
    ),
    network: z.enum(["Mainnet", "Preprod"], {
      message: "Network is required",
    }),
    range: z.string().optional().default("30d").pipe(agentAnalyticsRangeEnum),
    startDate: z.preprocess(
      (value) =>
        value === null || value === undefined || value === ""
          ? undefined
          : String(value).trim(),
      ymdDateSchema.optional(),
    ),
    endDate: z.preprocess(
      (value) =>
        value === null || value === undefined || value === ""
          ? undefined
          : String(value).trim(),
      ymdDateSchema.optional(),
    ),
    timeZone: z.preprocess(
      (value) =>
        value === null || value === undefined || value === ""
          ? undefined
          : String(value).trim(),
      timeZoneSchema.optional().default("Etc/UTC"),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.range === "custom") {
      if (!value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startDate"],
          message: "Start date is required for a custom range",
        });
      }
      if (!value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "End date is required for a custom range",
        });
      }
    }

    if (
      value.startDate &&
      value.endDate &&
      value.startDate.localeCompare(value.endDate) > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    }
  });

/** GET /api/dashboard/overview query. */
export const dashboardOverviewQuerySchema = z.object({
  network: z
    .string()
    .optional()
    .nullable()
    .transform((v) => parseNetwork(v)),
});

/** GET /api/agents/counts query. */
export const agentCountsQuerySchema = z.object({
  network: z
    .string()
    .optional()
    .nullable()
    .transform((v) => parseNetwork(v)),
});

/** GET /api/activity/transaction — single payment or purchase by id. */
export const activityTransactionQuerySchema = z.object({
  id: z.preprocess(
    (v) =>
      v === null || v === undefined || v === "" ? undefined : String(v).trim(),
    z.string().min(1, "Missing or invalid id or type"),
  ),
  type: z.preprocess(
    (v) =>
      v === null || v === undefined || v === ""
        ? undefined
        : String(v).trim().toLowerCase(),
    z.enum(["payment", "purchase"], {
      message: "Missing or invalid id or type",
    }),
  ),
  network: z
    .string()
    .optional()
    .nullable()
    .transform((v) => parseNetwork(v)),
});

const requiredString = (msg: string) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined ? msg : "Must be a non-empty string",
    })
    .min(1, msg);

/** GET /api/credentials/status query — required id. */
export const credentialStatusQuerySchema = z.object({
  id: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    requiredString("Credential ID is required"),
  ),
});

/** GET /api/credentials/reconcile query — required agentId. */
export const credentialReconcileQuerySchema = z.object({
  agentId: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    requiredString("Agent ID is required"),
  ),
});

/** GET /api/v1/agents/verify query — required agentIdentifier (public API). */
export const agentVerifyQuerySchema = z.object({
  agentIdentifier: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    requiredString("Agent identifier is required"),
  ),
});

/** [agentId] route param — validates format and length to prevent injection. */
export const agentIdRouteParamSchema = z
  .string()
  .min(1, "Agent ID is required")
  .max(64, "Agent ID is invalid");
