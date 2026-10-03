import { z } from "zod";

export const paymentNodeNetworkSchema = z.enum(["Preprod", "Mainnet"]);
export type PaymentNodeNetwork = z.infer<typeof paymentNodeNetworkSchema>;

export const unitAmountSchema = z.object({
  unit: z.string(),
  amount: z.union([z.string(), z.number().transform(String)]),
});
export const unitAmountNumberSchema = z.object({
  unit: z.string(),
  amount: z.number(),
});
