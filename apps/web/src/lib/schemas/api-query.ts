/**
 * Shared Zod schemas for API route query parameters.
 * Used across authenticated and public API routes for consistent validation.
 */

import { z } from "zod";

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
export const earningsPeriodSchema = z
  .enum(["24h", "7d", "30d", "all"])
  .default("7d");
export type EarningsPeriod = z.infer<typeof earningsPeriodSchema>;

/** Agent earnings period (GET /api/agents/[id]/earnings). */
export const agentEarningsPeriodSchema = z
  .enum(["1d", "7d", "30d", "all"])
  .default("7d");
export type AgentEarningsPeriod = z.infer<typeof agentEarningsPeriodSchema>;

/** GET /api/earnings query. */
export const earningsQuerySchema = z.object({
  period: z.string().optional().default("7d").pipe(earningsPeriodSchema),
});

/** GET /api/agents/[agentId]/earnings query. */
export const agentEarningsQuerySchema = z.object({
  period: z.string().optional().default("7d").pipe(agentEarningsPeriodSchema),
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

/** GET /api/credentials/status query — required id. */
export const credentialStatusQuerySchema = z.object({
  id: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z
      .string({ required_error: "Credential ID is required" })
      .min(1, "Credential ID is required"),
  ),
});

/** GET /api/credentials/reconcile query — required agentId. */
export const credentialReconcileQuerySchema = z.object({
  agentId: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z
      .string({ required_error: "Agent ID is required" })
      .min(1, "Agent ID is required"),
  ),
});

/** GET /api/v1/agents/verify query — required agentIdentifier (public API). */
export const agentVerifyQuerySchema = z.object({
  agentIdentifier: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z
      .string({ required_error: "Agent identifier is required" })
      .min(1, "Agent identifier is required"),
  ),
});
