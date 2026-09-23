import {
  MAX_SUPPORTED_PAYMENT_SOURCES,
  supportedPaymentSourceSchema,
  supportedPaymentSourcesSchema,
} from "@masumi/payment-source-x402/payment-source";
import { z } from "zod";

import {
  paymentNodeNetworkSchema,
  unitAmountSchema,
} from "./schema-primitives";
import { verificationsSchema } from "./verification-schemas";

export const registryRequestStateSchema = z.enum([
  "RegistrationRequested",
  "RegistrationInitiated",
  "RegistrationConfirmed",
  "RegistrationFailed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
  "UpdateRequested",
  "UpdateInitiated",
  "UpdateConfirmed",
  "UpdateFailed",
]);
export type RegistryRequestState = z.infer<typeof registryRequestStateSchema>;

export const registryEntryTypeSchema = z.enum(["Standard", "OpenApi", "X402"]);
export type RegistryEntryType = z.infer<typeof registryEntryTypeSchema>;

export const registryStatusFilterSchema = z.enum([
  "Registered",
  "Deregistered",
  "Pending",
  "Failed",
]);
export type RegistryStatusFilter = z.infer<typeof registryStatusFilterSchema>;

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
  type: registryEntryTypeSchema.optional(),
  apiBaseUrl: z.string().nullable(),
  openApiSpecUrl: z.string().nullable().optional(),
  x402ResourcesUrl: z.string().nullable().optional(),
  state: registryRequestStateSchema,
  error: z.string().nullable().optional(),
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
  AgentPricing: agentPricingSchema.nullable(),
  supportedPaymentSources: z
    .array(
      supportedPaymentSourceSchema.and(
        z.object({ id: z.string().min(1).optional() }),
      ),
    )
    .min(1)
    .max(MAX_SUPPORTED_PAYMENT_SOURCES)
    .nullable()
    .optional(),
  SmartContractWallet: z
    .object({ walletVkey: z.string(), walletAddress: z.string() })
    .optional(),
  RecipientWallet: z
    .object({ walletVkey: z.string(), walletAddress: z.string() })
    .nullable()
    .optional(),
  verifications: verificationsSchema.nullable().optional(),
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
  sendFundingLovelace: z.string().optional(),
  name: z.string(),
  apiBaseUrl: z.string(),
  description: z.string(),
  image: z.string().max(250).optional(),
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
  AgentPricing: z
    .union([
      z.object({ pricingType: z.literal("Free") }),
      z.object({ pricingType: z.literal("Dynamic") }),
      z.object({
        pricingType: z.literal("Fixed"),
        Pricing: z.array(unitAmountSchema),
      }),
    ])
    .optional(),
  supportedPaymentSources: supportedPaymentSourcesSchema.optional(),
  verifications: verificationsSchema.optional(),
});
export type RegisterAgentInput = z.infer<typeof registerAgentInputSchema>;

export const updateAgentInputSchema = registerAgentInputSchema
  .omit({ sellingWalletVkey: true })
  .extend({
    agentIdentifier: z.string().min(57).max(250),
    smartContractAddress: z.string().optional(),
    supportedPaymentSources: z
      .array(
        z.object({
          chain: z.string(),
          network: paymentNodeNetworkSchema,
          paymentSourceType: z.string(),
          address: z.string(),
        }),
      )
      .max(MAX_SUPPORTED_PAYMENT_SOURCES)
      .optional(),
  });
export type UpdateAgentInput = z.infer<typeof updateAgentInputSchema>;

export const registryAgentOnChainMetadataSchema = z
  .object({
    name: z.string(),
    apiBaseUrl: z.string(),
    description: z.string().nullable().optional(),
    image: z.string().optional(),
    metadataVersion: z.coerce.number().int().min(1).max(2),
    Tags: z.array(z.string()).optional(),
    ExampleOutputs: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          mimeType: z.string(),
        }),
      )
      .optional(),
    Capability: z
      .object({
        name: z.string(),
        version: z.string(),
      })
      .optional(),
    Author: z
      .object({
        name: z.string(),
        contactEmail: z.string().nullable().optional(),
        contactOther: z.string().nullable().optional(),
        organization: z.string().nullable().optional(),
      })
      .optional(),
    Legal: z
      .object({
        privacyPolicy: z.string().nullable().optional(),
        terms: z.string().nullable().optional(),
        other: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    AgentPricing: agentPricingSchema.optional(),
    supportedPaymentSources: z
      .array(supportedPaymentSourceSchema)
      .max(MAX_SUPPORTED_PAYMENT_SOURCES)
      .nullable()
      .optional(),
    verifications: verificationsSchema.nullable().optional(),
  })
  .passthrough();

export const registryAgentIdentifierMetadataSchema = z.object({
  policyId: z.string(),
  assetName: z.string(),
  agentIdentifier: z.string(),
  Metadata: registryAgentOnChainMetadataSchema,
});
export type RegistryAgentIdentifierMetadata = z.infer<
  typeof registryAgentIdentifierMetadataSchema
>;

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
