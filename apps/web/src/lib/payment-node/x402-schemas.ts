import { z } from "zod";

export const paymentNodeX402WalletSchema = z.object({
  id: z.string(),
  address: z.string(),
  type: z.enum(["Purchasing", "Selling"]),
  note: z.string().nullable(),
  createdById: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  privateKey: z.string().nullable().optional(),
});

export const paymentNodeX402WalletListSchema = z.object({
  Wallets: z.array(paymentNodeX402WalletSchema.omit({ privateKey: true })),
});

export const paymentNodeX402CreatePaymentOutputSchema = z.record(z.unknown());

export const paymentNodeX402VerifyOutputSchema = z.record(z.unknown());

export const paymentNodeX402SettleOutputSchema = z.record(z.unknown());
