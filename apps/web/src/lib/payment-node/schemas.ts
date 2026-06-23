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

export const registryStatusFilterSchema = z.enum([
  "Registered",
  "Deregistered",
  "Pending",
  "Failed",
]);
export type RegistryStatusFilter = z.infer<typeof registryStatusFilterSchema>;

const unitAmountSchema = z.object({
  unit: z.string(),
  amount: z.union([z.string(), z.number().transform(String)]),
});
const unitAmountNumberSchema = z.object({
  unit: z.string(),
  amount: z.number(),
});

const agentPricingFixedSchema = z.object({
  pricingType: z.literal("Fixed"),
  Pricing: z.array(unitAmountSchema),
});
const agentPricingDynamicSchema = z.object({
  pricingType: z.literal("Dynamic"),
});
const agentPricingFreeSchema = z.object({
  pricingType: z.literal("Free"),
});
const agentPricingUnknownSchema = z
  .object({
    pricingType: z.string().optional(),
  })
  .passthrough();
const agentPricingSchema = z.union([
  agentPricingFreeSchema,
  agentPricingDynamicSchema,
  agentPricingFixedSchema,
  agentPricingUnknownSchema,
]);

export const agentMetadataSchema = z.object({
  policyId: z.string(),
  assetName: z.string(),
  agentIdentifier: z.string(),
  Metadata: z.object({
    name: z.string().optional(),
    apiBaseUrl: z.string().optional(),
  }),
});
export type AgentMetadata = z.infer<typeof agentMetadataSchema>;

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
  RecipientWallet: z
    .object({ walletVkey: z.string(), walletAddress: z.string() })
    .nullable()
    .optional(),
});
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

const walletIdentitySchema = z.object({
  walletVkey: z.string(),
  walletAddress: z.string(),
});

const currentTransactionStatusSchema = z.enum([
  "Pending",
  "Confirmed",
  "FailedViaTimeout",
  "FailedViaManualReset",
  "RolledBack",
]);

const paymentNodeCurrentTransactionSchema = z.object({
  txHash: z.string().nullable(),
  status: currentTransactionStatusSchema,
  confirmations: z.number().nullable(),
  fees: z.string().nullable(),
  blockHeight: z.number().nullable(),
  blockTime: z.number().nullable(),
});

const inboxAgentOnChainMetadataSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  agentSlug: z.string(),
  metadataVersion: z.number(),
});

export const inboxAgentMetadataSchema = z.object({
  policyId: z.string(),
  assetName: z.string(),
  agentIdentifier: z.string(),
  Metadata: inboxAgentOnChainMetadataSchema,
});
export type InboxAgentMetadata = z.infer<typeof inboxAgentMetadataSchema>;

export const inboxAgentIdentifierMetadataSchema = inboxAgentMetadataSchema;
export type InboxAgentIdentifierMetadata = z.infer<
  typeof inboxAgentIdentifierMetadataSchema
>;

export const registryInboxEntrySchema = z.object({
  error: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  agentSlug: z.string(),
  state: registryRequestStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCheckedAt: z.string().nullable(),
  agentIdentifier: z.string().nullable(),
  metadataVersion: z.number(),
  sendFundingLovelace: z.string().nullable(),
  SmartContractWallet: walletIdentitySchema,
  RecipientWallet: walletIdentitySchema.nullable(),
  CurrentTransaction: paymentNodeCurrentTransactionSchema.nullable(),
});
export type RegistryInboxEntry = z.infer<typeof registryInboxEntrySchema>;

export const registerAgentInputSchema = z.object({
  network: paymentNodeNetworkSchema,
  sellingWalletVkey: z.string(),
  recipientWalletAddress: z.string().optional(),
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
    z.object({ pricingType: z.literal("Dynamic") }),
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

export const registerInboxAgentInputSchema = z.object({
  network: paymentNodeNetworkSchema,
  sellingWalletVkey: z.string(),
  recipientWalletAddress: z.string().optional(),
  sendFundingLovelace: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  agentSlug: z.string(),
});
export type RegisterInboxAgentInput = z.infer<
  typeof registerInboxAgentInputSchema
>;

export const deregisterInboxAgentInputSchema = z.object({
  network: paymentNodeNetworkSchema,
  agentIdentifier: z.string(),
  smartContractAddress: z.string().optional(),
});
export type DeregisterInboxAgentInput = z.infer<
  typeof deregisterInboxAgentInputSchema
>;

// ─── Registry list response ─────────────────────────────────────────────────

export const registryListResponseSchema = z.object({
  Assets: z.array(registryEntrySchema),
});

export const registryWalletResponseSchema = z.object({
  Assets: z.array(agentMetadataSchema),
});
export type RegistryWalletResponse = z.infer<
  typeof registryWalletResponseSchema
>;

export const registryInboxListResponseSchema = z.object({
  Assets: z.array(registryInboxEntrySchema),
});
export type RegistryInboxListResponse = z.infer<
  typeof registryInboxListResponseSchema
>;

export const registryInboxWalletResponseSchema = z.object({
  Assets: z.array(inboxAgentMetadataSchema),
});
export type RegistryInboxWalletResponse = z.infer<
  typeof registryInboxWalletResponseSchema
>;

export const registryInboxCountResponseSchema = z.object({
  total: z.number(),
});
export type RegistryInboxCountResponse = z.infer<
  typeof registryInboxCountResponseSchema
>;

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
    type: z.enum(["Selling", "Purchasing"]),
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
