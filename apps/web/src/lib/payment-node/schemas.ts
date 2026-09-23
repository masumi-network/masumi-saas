import { z } from "zod";

// ─── Primitives & enums ─────────────────────────────────────────────────────
import {
  paymentNodeNetworkSchema,
  unitAmountNumberSchema,
  unitAmountSchema,
} from "./schema-primitives";

export * from "./registry-schemas";
export {
  type PaymentNodeNetwork,
  paymentNodeNetworkSchema,
} from "./schema-primitives";
export type { Verification, Verifications } from "./verification-schemas";
export {
  VerificationMethod,
  verificationSchema,
  verificationsSchema,
} from "./verification-schemas";

// ─── Payment source ─────────────────────────────────────────────────────────

export const paymentSourceWalletSchema = z.object({
  id: z.string(),
  walletVkey: z.string(),
  walletAddress: z.string(),
  collectionAddress: z.string().nullable(),
  note: z.string().nullable(),
});
export type PaymentSourceWallet = z.infer<typeof paymentSourceWalletSchema>;

/** GET /payment-source list item (wallets are fetched via GET /wallet/list). */
export const paymentSourceInfoSchema = z.object({
  id: z.string(),
  network: paymentNodeNetworkSchema,
  smartContractAddress: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  policyId: z.string().nullable(),
  lastIdentifierChecked: z.string().nullable(),
  lastCheckedAt: z.string().nullable(),
  paymentSourceType: z.string().optional(),
  requiredAdminSignatures: z.number().nullable().optional(),
  AdminWallets: z.array(
    z.object({ walletAddress: z.string(), order: z.number() }),
  ),
  PurchasingWallets: z.array(paymentSourceWalletSchema).default([]),
  SellingWallets: z.array(paymentSourceWalletSchema).default([]),
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

export const paymentOrPurchaseItemSchema = z
  .object({
    id: z.union([z.string(), z.number().transform(String)]),
    createdAt: dateLikeSchema,
    updatedAt: dateLikeSchema,
    blockchainIdentifier: z.string().optional().default(""),
    agentIdentifier: z.string().nullable().optional(),
    onChainState: z.string().nullable().optional(),
    nextActionLastChangedAt: dateLikeSchema.optional(),
    onChainStateOrResultLastChangedAt: dateLikeSchema.optional(),
    nextActionOrOnChainStateOrResultLastChangedAt: dateLikeSchema.optional(),
    NextAction: z
      .object({
        requestedAction: z.string().nullable().optional(),
        errorType: z.string().nullable().optional(),
        errorNote: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    unlockTime: z.union([dateLikeSchema, z.null()]).optional(),
    payByTime: z.string().nullable().optional(),
    submitResultTime: z.string().optional(),
    RequestedFunds: z.array(unitAmountSchema).optional(),
    PaidFunds: z.array(unitAmountSchema).optional(),
    CurrentTransaction: z
      .object({
        txHash: z.string().nullable().optional(),
        status: z.string().optional(),
      })
      .nullable()
      .optional(),
    PaymentSource: z
      .object({
        network: z.string().optional(),
        smartContractAddress: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export type PaymentOrPurchaseItem = z.infer<typeof paymentOrPurchaseItemSchema>;

export const listPaymentsOutputSchema = z.object({
  Payments: z.array(paymentOrPurchaseItemSchema).default([]),
});
export type ListPaymentsOutput = z.infer<typeof listPaymentsOutputSchema>;

export const listPurchasesOutputSchema = z.object({
  Purchases: z.array(paymentOrPurchaseItemSchema).default([]),
});
export type ListPurchasesOutput = z.infer<typeof listPurchasesOutputSchema>;

// ─── Runtime payment endpoints ──────────────────────────────────────────────

export const createPaymentInputSchema = z.object({
  inputHash: z.string(),
  network: paymentNodeNetworkSchema,
  agentIdentifier: z.string(),
  RequestedFunds: z.array(unitAmountSchema).optional(),
  payByTime: z.string().optional(),
  submitResultTime: z.string().optional(),
  unlockTime: z.string().optional(),
  externalDisputeUnlockTime: z.string().optional(),
  metadata: z.string().optional(),
  identifierFromPurchaser: z.string(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

export const runtimePaymentResponseSchema = z
  .object({
    id: z.union([z.string(), z.number().transform(String)]),
    blockchainIdentifier: z.string(),
    agentIdentifier: z.string().nullable().optional(),
    inputHash: z.string().nullable().optional(),
    payByTime: z.string().nullable(),
    submitResultTime: z.string(),
    unlockTime: z.string(),
    externalDisputeUnlockTime: z.string(),
    onChainState: z.string().nullable().optional(),
    RequestedFunds: z.array(unitAmountSchema).optional(),
    NextAction: z
      .object({
        requestedAction: z.string().nullable().optional(),
        errorType: z.string().nullable().optional(),
        errorNote: z.string().nullable().optional(),
        resultHash: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    SmartContractWallet: z
      .object({
        id: z.string().optional(),
        walletVkey: z.string(),
        walletAddress: z.string(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export type RuntimePaymentResponse = z.infer<
  typeof runtimePaymentResponseSchema
>;

export const resolvePaymentInputSchema = z.object({
  blockchainIdentifier: z.string(),
  network: paymentNodeNetworkSchema,
  filterSmartContractAddress: z.string().nullable().optional(),
  includeHistory: z.boolean().optional(),
});
export type ResolvePaymentInput = z.infer<typeof resolvePaymentInputSchema>;

export const submitPaymentResultInputSchema = z.object({
  network: paymentNodeNetworkSchema,
  submitResultHash: z.string(),
  blockchainIdentifier: z.string(),
});
export type SubmitPaymentResultInput = z.infer<
  typeof submitPaymentResultInputSchema
>;

// ─── Income (matches payment node POST /payment/income: PascalCase, Units) ───

const incomeUnitsBlockSchema = z.object({
  Units: z.array(unitAmountNumberSchema),
  blockchainFees: z.number(),
});
const dailyFundsItemSchema = z.object({
  day: z.number(),
  month: z.number(),
  year: z.number(),
  Units: z.array(unitAmountNumberSchema),
  blockchainFees: z.number(),
});
const monthlyFundsItemSchema = z.object({
  month: z.number(),
  year: z.number(),
  Units: z.array(unitAmountNumberSchema),
  blockchainFees: z.number(),
});

export const paymentIncomeOutputSchema = z.object({
  agentIdentifier: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalTransactions: z.number(),
  TotalIncome: incomeUnitsBlockSchema,
  TotalRefunded: incomeUnitsBlockSchema,
  TotalPending: incomeUnitsBlockSchema,
  DailyIncome: z.array(dailyFundsItemSchema),
  DailyRefunded: z.array(dailyFundsItemSchema),
  DailyPending: z.array(dailyFundsItemSchema),
  MonthlyIncome: z.array(monthlyFundsItemSchema),
  MonthlyRefunded: z.array(monthlyFundsItemSchema),
  MonthlyPending: z.array(monthlyFundsItemSchema),
});
export type PaymentIncomeOutput = z.infer<typeof paymentIncomeOutputSchema>;

// ─── API key ───────────────────────────────────────────────────────────────

export const createApiKeyInputSchema = z.object({
  permission: z.enum(["Read", "ReadAndPay", "Admin"]),
  NetworkLimit: z.array(paymentNodeNetworkSchema),
  ChainIdLimit: z.array(z.string().min(1).max(120)).optional(),
  usageLimited: z.enum(["true", "false"]),
  UsageCredits: z.array(unitAmountSchema),
  walletScopeEnabled: z.enum(["true", "false"]).default("false"),
  WalletScopeHotWalletIds: z.array(z.string()).default([]),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export const paymentNodeApiKeySchema = z.object({
  id: z.string(),
  token: z.string(),
  permission: z.enum(["Read", "ReadAndPay", "Admin"]),
  canRead: z.boolean(),
  canPay: z.boolean(),
  canAdmin: z.boolean(),
  usageLimited: z.boolean(),
  NetworkLimit: z.array(paymentNodeNetworkSchema),
  RemainingUsageCredits: z.array(unitAmountSchema),
  status: z.string(),
  walletScopeEnabled: z.boolean(),
  WalletScopes: z.array(z.object({ hotWalletId: z.string() })),
});
export type PaymentNodeApiKey = z.infer<typeof paymentNodeApiKeySchema>;

export const createApiKeyOutputSchema = paymentNodeApiKeySchema;
export type CreateApiKeyOutput = z.infer<typeof createApiKeyOutputSchema>;

export const updateApiKeyInputSchema = z.object({
  id: z.string(),
  token: z.string().optional(),
  UsageCreditsToAddOrRemove: z.array(unitAmountSchema).optional(),
  usageLimited: z.boolean().optional(),
  status: z.enum(["Active", "Revoked"]).optional(),
  NetworkLimit: z.array(paymentNodeNetworkSchema).optional(),
  walletScopeEnabled: z.boolean().optional(),
  WalletScopeHotWalletIds: z.array(z.string()).optional(),
  canRead: z.boolean().optional(),
  canPay: z.boolean().optional(),
  canAdmin: z.boolean().optional(),
});
export type UpdateApiKeyInput = z.infer<typeof updateApiKeyInputSchema>;

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
  RemoveSellingWallets: z.array(z.object({ id: z.string() })).optional(),
  RemovePurchasingWallets: z.array(z.object({ id: z.string() })).optional(),
});
export type AddWalletToSourceInput = z.infer<
  typeof addWalletToSourceInputSchema
>;

export const addWalletToSourceOutputSchema = z.object({
  id: z.string(),
  network: paymentNodeNetworkSchema.optional(),
  /** Returned by PATCH /payment-source-extended; pass through to deregister when set. */
  smartContractAddress: z.string().optional(),
  PurchasingWalletsCount: z.number().optional(),
  SellingWalletsCount: z.number().optional(),
  SellingWallets: z.array(paymentSourceWalletSchema).optional().default([]),
  PurchasingWallets: z.array(paymentSourceWalletSchema).optional().default([]),
});

// ─── Wallet list (GET /wallet/list) ─────────────────────────────────────────

export const walletListItemSchema = z
  .object({
    id: z.string(),
    paymentSourceId: z.string(),
    type: z.enum(["Selling", "Purchasing", "Funding"]),
    walletVkey: z.string(),
    walletAddress: z.string(),
    collectionAddress: z.string().nullable(),
    note: z.string().nullable(),
  })
  .passthrough();
export type WalletListItem = z.infer<typeof walletListItemSchema>;

export const getWalletListOutputSchema = z.object({
  Wallets: z.array(walletListItemSchema),
});
export type GetWalletListOutput = z.infer<typeof getWalletListOutputSchema>;
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

export const patchWalletInputSchema = z.object({
  id: z.string(),
  newCollectionAddress: z.string().nullable(),
});
export type PatchWalletInput = z.infer<typeof patchWalletInputSchema>;

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

// ─── Address balance (GET /balance) ─────────────────────────────────────────

export const balanceAmountSchema = utxoAmountSchema;
export type BalanceAmount = z.infer<typeof balanceAmountSchema>;

export const getBalanceOutputSchema = z.object({
  Balance: z.array(balanceAmountSchema),
});
export type GetBalanceOutput = z.infer<typeof getBalanceOutputSchema>;

// ─── Webhooks ───────────────────────────────────────────────────────────────

export const webhookEventTypeSchema = z.enum([
  "PURCHASE_ON_CHAIN_STATUS_CHANGED",
  "PAYMENT_ON_CHAIN_STATUS_CHANGED",
  "PURCHASE_ON_ERROR",
  "PAYMENT_ON_ERROR",
  "WALLET_LOW_BALANCE",
  "X402_PAYMENT_SETTLED",
  "X402_PAYMENT_FAILED",
  "X402_WALLET_LOW_BALANCE",
]);

export const webhookEndpointSchema = z.object({
  id: z.string(),
  url: z.string(),
  Events: z.array(webhookEventTypeSchema),
  name: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paymentSourceId: z.string().nullable(),
  failureCount: z.number(),
  lastSuccessAt: z.string().nullable(),
  disabledAt: z.string().nullable(),
  CreatedBy: z
    .object({
      apiKeyId: z.string(),
      apiKeyToken: z.string().nullable(),
    })
    .nullable(),
});

export const listWebhooksOutputSchema = z.object({
  Webhooks: z.array(webhookEndpointSchema),
});
export type ListWebhooksOutput = z.infer<typeof listWebhooksOutputSchema>;
export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>;
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

// ─── Response envelope ──────────────────────────────────────────────────────

/** Payment node success response: { status: "success", data: T } */
export function parsePaymentNodeData<T>(
  data: unknown,
  schema: z.ZodType<T>,
): T {
  return schema.parse(data);
}
