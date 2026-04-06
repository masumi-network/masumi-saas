import { z } from "zod";

export const withdrawalStatusFilterSchema = z.enum([
  "all",
  "PENDING",
  "COMPLETED",
  "FAILED",
]);

export const withdrawalListQuerySchema = z.object({
  status: withdrawalStatusFilterSchema.default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type WithdrawalStatusFilter = z.infer<
  typeof withdrawalStatusFilterSchema
>;

const twoDecimalPlaces = (v: number) =>
  Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-8;

export const createWithdrawalBodySchema = z.object({
  amountUsd: z.coerce
    .number()
    .refine((v) => twoDecimalPlaces(v) && v > 0, "Invalid amount"),
  network: z.string().trim().min(1).max(120),
  payoutAddress: z.string().trim().min(1).max(500),
  destinationLabel: z.string().trim().max(200).optional(),
});

export type CreateWithdrawalBody = z.infer<typeof createWithdrawalBodySchema>;
