import { z } from "zod";

export const paymentNodeX402NetworkSchema = z.object({
  id: z.string(),
  caip2Id: z.string().regex(/^eip155:\d+$/),
  displayName: z.string(),
  rpcUrl: z.string(),
  isTestnet: z.boolean(),
  isEnabled: z.boolean(),
  defaultAsset: z.string().nullable(),
  facilitatorWalletId: z.string().nullable(),
  facilitatorUrl: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const paymentNodeX402NetworkListSchema = z.object({
  Networks: z.array(paymentNodeX402NetworkSchema),
});

export const paymentNodeX402WalletSchema = z.object({
  id: z.string(),
  networkId: z.string(),
  caip2Network: z.string().regex(/^eip155:\d+$/),
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

export const paymentNodeX402VerifyOutputSchema = z.record(
  z.string(),
  z.unknown(),
);

export const paymentNodeX402SettleOutputSchema = z.record(
  z.string(),
  z.unknown(),
);
