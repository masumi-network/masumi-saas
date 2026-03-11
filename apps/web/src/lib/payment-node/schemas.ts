/**
 * Zod schemas mirroring the payment node API request/response shapes.
 * Parse all responses through these so the app stays in sync with the API.
 */

import { z } from "zod";

// ─── Primitives & enums ─────────────────────────────────────────────────────

export const paymentNodeNetworkSchema = z.enum(["Preprod", "Mainnet"]);
export type PaymentNodeNetwork = z.infer<typeof paymentNodeNetworkSchema>;

export const registryRequestStateSchema = z.enum([
  "RegistrationRequested",
  "RegistrationInitiated",
  "RegistrationConfirmed",
  "RegistrationFailed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
]);
export type RegistryRequestState = z.infer<typeof registryRequestStateSchema>;

const unitAmountSchema = z.object({ unit: z.string(), amount: z.string() });
const unitAmountNumberSchema = z.object({
  unit: z.string(),
  amount: z.number(),
});

const agentPricingFixedSchema = z.object({
  pricingType: z.literal("Fixed"),
  Pricing: z.array(unitAmountSchema),
});
const agentPricingFreeSchema = z.object({
  pricingType: z.literal("Free"),
});
const agentPricingSchema = z.union([
  agentPricingFreeSchema,
  agentPricingFixedSchema,
]);

// ─── Registry ───────────────────────────────────────────────────────────────

export const registryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  apiBaseUrl: z.string(),
  state: registryRequestStateSchema,
  agentIdentifier: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  Capability: z.object({
    name: z.string().nullable(),
    version: z.string().nullable(),
  }),
  Author: z.object({
    name: z.string(),
    contactEmail: z.string().nullable(),
    contactOther: z.string().nullable(),
    organization: z.string().nullable(),
  }),
  Tags: z.array(z.string()),
  AgentPricing: agentPricingSchema,
  SmartContractWallet: z
    .object({ walletVkey: z.string(), walletAddress: z.string() })
    .optional(),
});
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

export const registerAgentInputSchema = z.object({
  network: paymentNodeNetworkSchema,
  sellingWalletVkey: z.string(),
  name: z.string(),
  apiBaseUrl: z.string(),
  description: z.string(),
  Tags: z.array(z.string()),
  ExampleOutputs: z.array(
    z.object({ name: z.string(), url: z.string(), mimeType: z.string() }),
  ),
  Capability: z.object({ name: z.string(), version: z.string() }),
  Author: z.object({
    name: z.string(),
    contactEmail: z.string().optional(),
    contactOther: z.string().optional(),
    organization: z.string().optional(),
  }),
  Legal: z
    .object({
      privacyPolicy: z.string().optional(),
      terms: z.string().optional(),
      other: z.string().optional(),
    })
    .optional(),
  AgentPricing: z.union([
    z.object({ pricingType: z.literal("Free") }),
    z.object({
      pricingType: z.literal("Fixed"),
      Pricing: z.array(unitAmountSchema),
    }),
  ]),
});
export type RegisterAgentInput = z.infer<typeof registerAgentInputSchema>;

export const deregisterAgentInputSchema = z.object({
  network: paymentNodeNetworkSchema,
  agentIdentifier: z.string(),
  smartContractAddress: z.string().optional(),
});
export type DeregisterAgentInput = z.infer<typeof deregisterAgentInputSchema>;

// ─── Registry list response ─────────────────────────────────────────────────

export const registryListResponseSchema = z.object({
  Assets: z.array(registryEntrySchema),
});

// ─── Payment source ─────────────────────────────────────────────────────────

export const paymentSourceInfoSchema = z.object({
  id: z.string(),
  network: paymentNodeNetworkSchema,
  smartContractAddress: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  policyId: z.string().nullable(),
  lastIdentifierChecked: z.string().nullable(),
  lastCheckedAt: z.string().nullable(),
  AdminWallets: z.array(
    z.object({ walletAddress: z.string(), order: z.number() }),
  ),
  PurchasingWallets: z.array(
    z.object({
      id: z.string(),
      walletVkey: z.string(),
      walletAddress: z.string(),
      collectionAddress: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  SellingWallets: z.array(
    z.object({
      id: z.string(),
      walletVkey: z.string(),
      walletAddress: z.string(),
      collectionAddress: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  FeeReceiverNetworkWallet: z.object({ walletAddress: z.string() }).nullable(),
  feeRatePermille: z.number(),
});
export type PaymentSourceInfo = z.infer<typeof paymentSourceInfoSchema>;

export const getPaymentSourcesOutputSchema = z.object({
  PaymentSources: z.array(paymentSourceInfoSchema),
});
export type GetPaymentSourcesOutput = z.infer<
  typeof getPaymentSourcesOutputSchema
>;

// ─── Payment / purchase list items ──────────────────────────────────────────

/** Coerce date-like (ISO string or ms number) to string for payment node responses. */
const dateLikeSchema = z.union([
  z.string(),
  z.number().transform((n) => new Date(n).toISOString()),
]);

export const paymentOrPurchaseItemSchema = z.object({
  id: z.string(),
  createdAt: dateLikeSchema,
  updatedAt: dateLikeSchema,
  blockchainIdentifier: z.string(),
  agentIdentifier: z.string().nullable(),
  onChainState: z.string().nullable(),
  nextActionLastChangedAt: dateLikeSchema.optional(),
  onChainStateOrResultLastChangedAt: dateLikeSchema.optional(),
  nextActionOrOnChainStateOrResultLastChangedAt: dateLikeSchema.optional(),
  NextAction: z
    .object({
      requestedAction: z.string().optional(),
      errorType: z.string().optional(),
      errorNote: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  unlockTime: z.string().nullable().optional(),
  payByTime: z.string().nullable().optional(),
  submitResultTime: z.string().optional(),
  RequestedFunds: z.array(unitAmountSchema).optional(),
  CurrentTransaction: z
    .object({ txHash: z.string().nullable(), status: z.string() })
    .nullable()
    .optional(),
  PaymentSource: z
    .object({ network: z.string(), smartContractAddress: z.string() })
    .optional(),
});
export type PaymentOrPurchaseItem = z.infer<typeof paymentOrPurchaseItemSchema>;

export const listPaymentsOutputSchema = z.object({
  Payments: z.array(paymentOrPurchaseItemSchema).default([]),
});
export type ListPaymentsOutput = z.infer<typeof listPaymentsOutputSchema>;

export const listPurchasesOutputSchema = z.object({
  Purchases: z.array(paymentOrPurchaseItemSchema).default([]),
});
export type ListPurchasesOutput = z.infer<typeof listPurchasesOutputSchema>;

// ─── Income ─────────────────────────────────────────────────────────────────

const incomeUnitsBlockSchema = z.object({
  units: z.array(unitAmountNumberSchema),
  blockchainFees: z.number(),
});
const dailyMonthlyUnitsSchema = z.object({
  day: z.number().optional(),
  month: z.number(),
  year: z.number(),
  units: z.array(unitAmountNumberSchema),
  blockchainFees: z.number(),
});

export const paymentIncomeOutputSchema = z.object({
  agentIdentifier: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalTransactions: z.number(),
  totalIncome: incomeUnitsBlockSchema,
  totalRefunded: incomeUnitsBlockSchema,
  totalPending: incomeUnitsBlockSchema,
  dailyIncome: z.array(dailyMonthlyUnitsSchema),
  dailyRefunded: z.array(dailyMonthlyUnitsSchema),
  dailyPending: z.array(dailyMonthlyUnitsSchema),
  monthlyIncome: z.array(dailyMonthlyUnitsSchema),
  monthlyRefunded: z.array(dailyMonthlyUnitsSchema),
  monthlyPending: z.array(dailyMonthlyUnitsSchema),
});
export type PaymentIncomeOutput = z.infer<typeof paymentIncomeOutputSchema>;

// ─── API key ───────────────────────────────────────────────────────────────

export const createApiKeyInputSchema = z.object({
  permission: z.enum(["Read", "ReadAndPay", "Admin"]),
  networkLimit: z.array(paymentNodeNetworkSchema),
  usageLimited: z.enum(["true", "false"]),
  UsageCredits: z.array(unitAmountSchema),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export const createApiKeyOutputSchema = z.object({
  id: z.string(),
  token: z.string(),
  permission: z.string(),
  usageLimited: z.boolean(),
  networkLimit: z.array(paymentNodeNetworkSchema),
  RemainingUsageCredits: z.array(unitAmountSchema),
  status: z.string(),
});
export type CreateApiKeyOutput = z.infer<typeof createApiKeyOutputSchema>;

// ─── Wallets ───────────────────────────────────────────────────────────────

export const addWalletToSourceInputSchema = z.object({
  paymentSourceId: z.string(),
  AddSellingWallets: z
    .array(
      z.object({
        walletMnemonic: z.string(),
        note: z.string(),
        collectionAddress: z.string().nullable(),
      }),
    )
    .optional(),
  AddPurchasingWallets: z
    .array(
      z.object({
        walletMnemonic: z.string(),
        note: z.string(),
        collectionAddress: z.string().nullable(),
      }),
    )
    .optional(),
});
export type AddWalletToSourceInput = z.infer<
  typeof addWalletToSourceInputSchema
>;

export const paymentSourceWalletSchema = z.object({
  id: z.string(),
  walletVkey: z.string(),
  walletAddress: z.string(),
  collectionAddress: z.string().nullable(),
  note: z.string().nullable(),
});
export type PaymentSourceWallet = z.infer<typeof paymentSourceWalletSchema>;

export const addWalletToSourceOutputSchema = z.object({
  id: z.string(),
  SellingWallets: z.array(paymentSourceWalletSchema),
  PurchasingWallets: z.array(paymentSourceWalletSchema),
});
export type AddWalletToSourceOutput = z.infer<
  typeof addWalletToSourceOutputSchema
>;

export const generatedWalletSchema = z.object({
  walletMnemonic: z.string(),
  walletAddress: z.string(),
  walletVkey: z.string(),
});
export type GeneratedWallet = z.infer<typeof generatedWalletSchema>;

export const walletStatusSchema = z.object({
  note: z.string().nullable(),
  walletVkey: z.string(),
  walletAddress: z.string(),
  collectionAddress: z.string().nullable(),
  PendingTransaction: z
    .object({
      createdAt: z.string(),
      updatedAt: z.string(),
      hash: z.string().nullable(),
      lastCheckedAt: z.string().nullable(),
    })
    .nullable(),
});
export type WalletStatus = z.infer<typeof walletStatusSchema>;

// ─── UTXOs ─────────────────────────────────────────────────────────────────

export const utxoAmountSchema = z.object({
  unit: z.string(),
  quantity: z.number(),
});
export const utxoSchema = z.object({
  txHash: z.string(),
  address: z.string(),
  Amounts: z.array(utxoAmountSchema),
  dataHash: z.string().nullable(),
  inlineDatum: z.string().nullable(),
  referenceScriptHash: z.string().nullable(),
  outputIndex: z.number(),
  block: z.string(),
});
export const getUtxosOutputSchema = z.object({
  Utxos: z.array(utxoSchema),
});
export type GetUtxosOutput = z.infer<typeof getUtxosOutputSchema>;
export type Utxo = z.infer<typeof utxoSchema>;
export type UtxoAmount = z.infer<typeof utxoAmountSchema>;

// ─── Response envelope ──────────────────────────────────────────────────────

/** Payment node success response: { status: "success", data: T } */
export function parsePaymentNodeData<T>(
  data: unknown,
  schema: z.ZodType<T>,
): T {
  return schema.parse(data);
}
