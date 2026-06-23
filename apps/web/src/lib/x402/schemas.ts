import {
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentStatus,
} from "@masumi/database";

import { z } from "@/lib/zod-openapi";

export const caip2Eip155Schema = z
  .string()
  .regex(
    /^eip155:\d+$/,
    "Network must be a CAIP-2 EVM chain id, for example eip155:8453",
  );

export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address");

export const uintStringSchema = z
  .string()
  .regex(/^\d+$/, "Expected an unsigned integer string");

export const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const paymentIdentifierSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

export const x402PaymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: caip2Eip155Schema,
  asset: evmAddressSchema,
  amount: uintStringSchema,
  payTo: evmAddressSchema,
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export const x402PaymentPayloadSchema = z.object({
  x402Version: z.number().int(),
  resource: z
    .object({
      url: z.string(),
    })
    .partial()
    .optional(),
  accepted: x402PaymentRequirementsSchema,
  payload: z.record(z.string(), z.unknown()),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export const verifySettleSchemaInput = z.object({
  supportedPaymentSourceId: z.string(),
  paymentPayload: x402PaymentPayloadSchema,
  orgApiKeyId: z.string().optional(),
});

export const verifySchemaOutput = z.object({
  attemptId: z.string(),
  paymentPayloadHash: z.string(),
  paymentIdentifier: z.string().nullable(),
  verifyResponse: z.object({
    isValid: z.boolean(),
    invalidReason: z.string().optional(),
    invalidMessage: z.string().optional(),
    payer: z.string().optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const settleSchemaOutput = z.object({
  attemptId: z.string(),
  paymentPayloadHash: z.string(),
  paymentIdentifier: z.string().nullable(),
  replay: z.boolean(),
  settleResponse: z.object({
    success: z.boolean(),
    errorReason: z.string().optional(),
    errorMessage: z.string().optional(),
    payer: z.string().optional(),
    transaction: z.string(),
    network: caip2Eip155Schema,
    amount: z.string().optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const forwardedX402RequirementSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  asset: z.string(),
  amount: uintStringSchema,
  payTo: z.string(),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export const forwardedX402PaymentRequiredSchema = z.object({
  x402Version: z.number().int(),
  resource: z
    .object({
      url: z.string(),
    })
    .partial()
    .optional(),
  accepts: z.array(forwardedX402RequirementSchema).min(1).max(20),
  extensions: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export const createPaymentSchemaInput = z.object({
  orgApiKeyId: z
    .string()
    .describe("Org API key that owns the outbound x402 wallet budget"),
  evmWalletId: z.string(),
  paymentRequired: forwardedX402PaymentRequiredSchema,
  preferredNetwork: caip2Eip155Schema.optional(),
  preferredAsset: evmAddressSchema.optional(),
  paymentIdentifier: paymentIdentifierSchema,
});

export const createPaymentSchemaOutput = z.object({
  attemptId: z.string(),
  payer: evmAddressSchema,
  caip2Network: caip2Eip155Schema,
  asset: evmAddressSchema,
  amount: uintStringSchema,
  payTo: evmAddressSchema,
  xPaymentHeader: z.string(),
  paymentPayload: z.record(z.string(), z.unknown()),
  paymentPayloadHash: z.string(),
  paymentIdentifier: z.string().nullable(),
});

export const deleteWalletSchemaInput = z.object({
  id: z.string(),
});

export const deleteWalletSchemaOutput = z.object({
  id: z.string(),
});

export const walletNoteSchema = z.string().max(250);

export const walletSchemaOutput = z
  .object({
    id: z.string(),
    address: evmAddressSchema,
    type: z.nativeEnum(X402EvmWalletType),
    note: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("X402Wallet");

export const createWalletSchemaInput = z.object({
  type: z.nativeEnum(X402EvmWalletType),
  note: walletNoteSchema.optional(),
  privateKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

export const updateWalletSchemaInput = z.object({
  id: z.string(),
  note: walletNoteSchema.nullable(),
});

export const listWalletsSchemaInput = z.object({
  take: z.coerce.number().min(1).max(100).default(20),
  cursorId: z.string().max(550).optional(),
  type: z.nativeEnum(X402EvmWalletType).optional(),
});

export const listWalletsSchemaOutput = z.object({
  Wallets: z.array(walletSchemaOutput),
});

export const createWalletSchemaOutput = walletSchemaOutput
  .extend({
    privateKey: z.string().nullable(),
  })
  .openapi("X402WalletCreated");

export const x402NetworkSchema = z
  .object({
    id: z.string(),
    caip2Id: caip2Eip155Schema,
    displayName: z.string(),
    rpcUrl: z.string(),
    isTestnet: z.boolean(),
    isEnabled: z.boolean(),
    defaultAsset: evmAddressSchema.nullable(),
    facilitatorWalletId: z.string().nullable(),
    facilitatorWalletAddress: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("X402Network");

export const upsertNetworkSchemaInput = z.object({
  caip2Id: caip2Eip155Schema,
  displayName: z.string().min(1).max(120),
  rpcUrl: z.string().url(),
  isTestnet: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  defaultAsset: evmAddressSchema.nullable().optional(),
  facilitatorWalletId: z.string().nullable().optional(),
});

export const listNetworksSchemaInput = z.object({
  isTestnet: booleanQuerySchema.optional(),
});

export const listNetworksSchemaOutput = z.object({
  Networks: z.array(x402NetworkSchema),
});

export const budgetSchema = z
  .object({
    id: z.string(),
    orgApiKeyId: z.string(),
    evmWalletId: z.string(),
    evmWalletAddress: z.string(),
    caip2Network: caip2Eip155Schema,
    asset: evmAddressSchema,
    remainingAmount: z.string(),
    spentAmount: z.string(),
    createdByUserId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("X402Budget");

export const setBudgetSchemaInput = z.object({
  orgApiKeyId: z.string(),
  evmWalletId: z.string(),
  caip2Network: caip2Eip155Schema,
  asset: evmAddressSchema,
  remainingAmount: uintStringSchema,
});

export const listBudgetSchemaInput = z.object({
  orgApiKeyId: z.string().optional(),
});

export const listBudgetSchemaOutput = z.object({
  Budgets: z.array(budgetSchema),
});

export const x402SettlementSummarySchema = z.object({
  id: z.string(),
  success: z.boolean(),
  txHash: z.string().nullable(),
  amount: z.string().nullable(),
  payer: z.string().nullable(),
  createdAt: z.date(),
});

export const x402PaymentAttemptSchema = z
  .object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    direction: z.nativeEnum(X402PaymentDirection),
    status: z.nativeEnum(X402PaymentStatus),
    userId: z.string(),
    orgApiKeyId: z.string().nullable(),
    evmWalletId: z.string().nullable(),
    agentId: z.string().nullable(),
    supportedPaymentSourceId: z.string().nullable(),
    caip2Network: z.string(),
    asset: z.string(),
    amount: z.string(),
    payTo: z.string(),
    payer: z.string().nullable(),
    resource: z.string().nullable(),
    paymentIdentifier: z.string().nullable(),
    errorReason: z.string().nullable(),
    errorMessage: z.string().nullable(),
    Settlement: x402SettlementSummarySchema.nullable(),
  })
  .openapi("X402PaymentAttempt");

export const listPaymentAttemptsSchemaInput = z.object({
  take: z.coerce.number().min(1).max(100).default(20),
  cursorId: z.string().max(550).optional(),
  status: z.nativeEnum(X402PaymentStatus).optional(),
  direction: z.nativeEnum(X402PaymentDirection).optional(),
  caip2Network: caip2Eip155Schema.optional(),
});

export const listPaymentAttemptsSchemaOutput = z.object({
  PaymentAttempts: z.array(x402PaymentAttemptSchema),
});

export const x402SettlementSchema = z
  .object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    paymentAttemptId: z.string(),
    success: z.boolean(),
    txHash: z.string().nullable(),
    caip2Network: z.string(),
    amount: z.string().nullable(),
    payer: z.string().nullable(),
  })
  .openapi("X402SettlementRecord");

export const listSettlementsSchemaInput = z.object({
  take: z.coerce.number().min(1).max(100).default(20),
  cursorId: z.string().max(550).optional(),
  caip2Network: caip2Eip155Schema.optional(),
});

export const listSettlementsSchemaOutput = z.object({
  Settlements: z.array(x402SettlementSchema),
});
