import { z } from "zod";

import { type CardanoNetwork, isAllowedCaip2Network } from "./network.js";

export const PaymentSourceType = {
  Web3CardanoV1: "Web3CardanoV1",
  Web3CardanoV2: "Web3CardanoV2",
} as const;

export type PaymentSourceTypeValue =
  (typeof PaymentSourceType)[keyof typeof PaymentSourceType];

export const SupportedPaymentSourceChain = {
  Cardano: "Cardano",
  EVM: "EVM",
} as const;

export const PricingType = {
  Fixed: "Fixed",
  Dynamic: "Dynamic",
  Free: "Free",
} as const;

export type PricingTypeValue = (typeof PricingType)[keyof typeof PricingType];

const cardanoNetworkSchema = z.enum(["Mainnet", "Preprod"]);

const paymentSourceTypeSchema = z.enum([
  PaymentSourceType.Web3CardanoV1,
  PaymentSourceType.Web3CardanoV2,
]);

const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address");

const EVM_NATIVE_SENTINEL_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);

const x402AssetSchema = evmAddressSchema.refine(
  (asset) => !EVM_NATIVE_SENTINEL_ADDRESSES.has(asset.toLowerCase()),
  "Native-asset sentinel addresses are not ERC-20 token contracts",
);

export const atomicAmountSchema = z
  .string()
  .max(19)
  .regex(/^\d+$/)
  .refine((amount) => {
    if (!/^\d+$/.test(amount)) return false;
    const parsedAmount = BigInt(amount);
    return parsedAmount > 0n;
  }, "Atomic amount must be greater than zero");

const supportedPaymentSourceFixedPriceSchema = z.object({
  asset: z.string().max(250),
  amount: atomicAmountSchema,
  decimals: z.number().int().min(0).max(255).optional(),
});

const supportedPaymentSourceDynamicAssetSchema = z.object({
  asset: z.string().max(250),
  decimals: z.number().int().min(0).max(255).optional(),
});

export const supportedPaymentSourcePricingSchema = z.union([
  z.object({
    pricingType: z.literal(PricingType.Fixed),
    fixed: z.array(supportedPaymentSourceFixedPriceSchema).min(1).max(5),
  }),
  z.object({
    pricingType: z.literal(PricingType.Dynamic),
    dynamic: z
      .array(supportedPaymentSourceDynamicAssetSchema)
      .min(1)
      .max(1)
      .optional(),
  }),
  z.object({
    pricingType: z.literal(PricingType.Free),
  }),
]);

export type SupportedPaymentSourcePricing = z.infer<
  typeof supportedPaymentSourcePricingSchema
>;

const cardanoSupportedPaymentSourceSchema = z.object({
  chain: z.literal(SupportedPaymentSourceChain.Cardano),
  network: cardanoNetworkSchema,
  paymentSourceType: paymentSourceTypeSchema,
  address: z.string().max(250),
  pricing: supportedPaymentSourcePricingSchema,
});

const x402SupportedPaymentSourceBaseSchema = z.object({
  chain: z.literal(SupportedPaymentSourceChain.EVM),
  network: z
    .string()
    .regex(/^eip155:\d+$/, "x402 EVM network must be a CAIP-2 eip155 chain id"),
  paymentSourceType: paymentSourceTypeSchema.nullable().optional(),
  address: evmAddressSchema.optional(),
  scheme: z.literal("Exact"),
  payTo: evmAddressSchema,
  resource: z.string().url().max(500).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

const x402SupportedPaymentSourceSchema =
  x402SupportedPaymentSourceBaseSchema.extend({
    pricing: supportedPaymentSourcePricingSchema,
  });

export const supportedPaymentSourceSchema = z
  .union([
    cardanoSupportedPaymentSourceSchema,
    x402SupportedPaymentSourceSchema,
  ])
  .superRefine((source, ctx) => {
    if (
      source.chain === SupportedPaymentSourceChain.EVM &&
      source.address != null &&
      source.address.toLowerCase() !== source.payTo.toLowerCase()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address"],
        message: "x402 address alias must match payTo",
      });
    }

    if (source.chain === SupportedPaymentSourceChain.Cardano) {
      if (source.pricing.pricingType === PricingType.Fixed) {
        source.pricing.fixed.forEach((price, index) => {
          if (price.decimals != null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pricing", "fixed", index, "decimals"],
              message: "Cardano fixed pricing does not use decimals",
            });
          }
        });
      }
      if (
        source.pricing.pricingType === PricingType.Dynamic &&
        source.pricing.dynamic != null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricing", "dynamic"],
          message:
            "Cardano dynamic pricing does not support an asset allowlist",
        });
      }
      return;
    }

    if (source.pricing.pricingType === PricingType.Fixed) {
      if (source.pricing.fixed.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricing", "fixed"],
          message: "Fixed x402 pricing requires exactly one asset",
        });
        return;
      }
      const [price] = source.pricing.fixed;
      if (!x402AssetSchema.safeParse(price.asset).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricing", "fixed", 0, "asset"],
          message:
            "Fixed x402 pricing requires an ERC-20 token contract address",
        });
      }
      if (price.decimals == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricing", "fixed", 0, "decimals"],
          message: "Fixed x402 pricing requires token decimals",
        });
      }
    }

    if (
      source.pricing.pricingType === PricingType.Dynamic &&
      source.pricing.dynamic != null
    ) {
      const [acceptedAsset] = source.pricing.dynamic;
      if (!x402AssetSchema.safeParse(acceptedAsset.asset).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricing", "dynamic", 0, "asset"],
          message:
            "Dynamic x402 accepted asset must be an ERC-20 token contract address",
        });
      }
      if (acceptedAsset.decimals == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricing", "dynamic", 0, "decimals"],
          message: "Dynamic x402 accepted asset requires token decimals",
        });
      }
    }
  });

export const MAX_SUPPORTED_PAYMENT_SOURCES = 25;

/** Default x402 settlement extra for on-chain registry metadata (permit2 USDC). */
export const DEFAULT_EVM_REGISTRY_EXTRA = {
  assetTransferMethod: "permit2",
} as const;

function isNonEmptyExtraRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/** Payment node persists omitted `extra` as null; registry mint requires a JSON object. */
export function resolveEvmRegistryExtra(
  extra: unknown,
  decimals?: number,
): Record<string, unknown> {
  if (isNonEmptyExtraRecord(extra)) {
    return extra;
  }
  return {
    ...DEFAULT_EVM_REGISTRY_EXTRA,
    ...(decimals != null ? { decimals } : {}),
  };
}

export const supportedPaymentSourcesSchema = z
  .array(supportedPaymentSourceSchema)
  .min(1)
  .max(MAX_SUPPORTED_PAYMENT_SOURCES);

export type SupportedPaymentSource = z.infer<
  typeof supportedPaymentSourceSchema
>;

export type EvmSupportedPaymentSource = Extract<
  SupportedPaymentSource,
  { chain: "EVM" }
>;

/** Flat Fixed x402 fields used by SaaS UI / DB rows. */
export function getEvmFixedPrice(
  source: EvmSupportedPaymentSource,
): { asset: string; amount: string; decimals: number } | null {
  if (source.pricing.pricingType !== PricingType.Fixed) return null;
  const price = source.pricing.fixed[0];
  if (price == null || price.decimals == null) return null;
  return {
    asset: price.asset,
    amount: price.amount,
    decimals: price.decimals,
  };
}

export function buildEvmExactFixedPaymentSource(params: {
  network: string;
  payTo: string;
  asset: string;
  amount: string;
  decimals: number;
  resource?: string;
  extra?: Record<string, unknown>;
  address?: string;
}): EvmSupportedPaymentSource {
  return {
    chain: SupportedPaymentSourceChain.EVM,
    network: params.network,
    paymentSourceType: null,
    address: params.address ?? params.payTo,
    scheme: "Exact",
    payTo: params.payTo,
    ...(params.resource ? { resource: params.resource } : {}),
    extra: resolveEvmRegistryExtra(params.extra, params.decimals),
    pricing: {
      pricingType: PricingType.Fixed,
      fixed: [
        {
          asset: params.asset,
          amount: params.amount,
          decimals: params.decimals,
        },
      ],
    },
  };
}

const metadataStringSchema = z.string().or(z.array(z.string()).min(1));

function metadataToString(value: string | string[] | undefined) {
  if (value == undefined) return undefined;
  if (typeof value === "string") return value;
  return value.join("");
}

function parseMetadataDecimals(
  value: string | string[] | undefined,
): number | undefined {
  const decimals = metadataToString(value);
  if (decimals == null) return undefined;
  return /^\d+$/.test(decimals) ? Number(decimals) : Number.NaN;
}

const supportedPaymentSourceMetadataAssetSchema = z.object({
  asset: metadataStringSchema,
  decimals: metadataStringSchema.optional(),
});

const supportedPaymentSourceMetadataAmountSchema =
  supportedPaymentSourceMetadataAssetSchema.extend({
    amount: metadataStringSchema,
  });

const supportedPaymentSourceMetadataPricingSchema = z.object({
  pricingType: metadataStringSchema,
  fixed: z.array(supportedPaymentSourceMetadataAmountSchema).optional(),
  dynamic: z.array(supportedPaymentSourceMetadataAssetSchema).optional(),
});

const supportedPaymentSourceMetadataSettlementSchema = z.object({
  paymentSourceType: metadataStringSchema.optional(),
  address: metadataStringSchema.optional(),
  scheme: metadataStringSchema.optional(),
  payTo: metadataStringSchema.optional(),
  resource: metadataStringSchema.optional(),
  extra: z.unknown().optional(),
});

export const supportedPaymentSourceMetadataSchema = z.object({
  chain: metadataStringSchema,
  network: metadataStringSchema,
  settlement: supportedPaymentSourceMetadataSettlementSchema.optional(),
  pricing: supportedPaymentSourceMetadataPricingSchema.optional(),
});

function validateCardanoAddressForNetwork(
  address: string,
  network: CardanoNetwork,
) {
  const expectedPrefix = network === "Mainnet" ? "addr1" : "addr_test";
  if (!address.startsWith(expectedPrefix)) {
    throw new Error(
      "Supported Cardano payment source address does not match the registry network",
    );
  }
}

export function isCardanoAddressForNetwork(
  address: string,
  network: CardanoNetwork,
): boolean {
  try {
    validateCardanoAddressForNetwork(address, network);
    return true;
  } catch {
    return false;
  }
}

export function normalizeSupportedPaymentSourceInput(
  source: SupportedPaymentSource,
): SupportedPaymentSource {
  if (source.chain === SupportedPaymentSourceChain.EVM) {
    const fixed = getEvmFixedPrice(source);
    return {
      ...source,
      address: source.address ?? source.payTo,
      extra: resolveEvmRegistryExtra(source.extra, fixed?.decimals),
    };
  }
  return source;
}

export function validateSupportedPaymentSourcesOrThrow(
  supportedPaymentSources: SupportedPaymentSource[],
  expectedNetwork: CardanoNetwork,
  registeringPaymentSourceType?: PaymentSourceTypeValue,
  allowedCaip2Networks?: string[] | null,
) {
  for (const supportedPaymentSource of supportedPaymentSources) {
    if (supportedPaymentSource.chain === SupportedPaymentSourceChain.EVM) {
      if (registeringPaymentSourceType !== PaymentSourceType.Web3CardanoV2) {
        throw new Error(
          "x402 payment sources may only be advertised by V2 registry entries.",
        );
      }
      const fixed = getEvmFixedPrice(supportedPaymentSource);
      if (fixed && BigInt(fixed.amount) <= 0n) {
        throw new Error("x402 payment source amount must be greater than zero");
      }
      if (
        allowedCaip2Networks !== undefined &&
        !isAllowedCaip2Network(
          allowedCaip2Networks,
          supportedPaymentSource.network,
        )
      ) {
        throw new Error(
          "Not authorized to advertise x402 payment sources on this network",
        );
      }
      continue;
    }

    if (supportedPaymentSource.network !== expectedNetwork) {
      throw new Error(
        "Supported payment source network must match the registry network",
      );
    }

    if (
      registeringPaymentSourceType === PaymentSourceType.Web3CardanoV2 &&
      supportedPaymentSource.paymentSourceType !==
        PaymentSourceType.Web3CardanoV2
    ) {
      throw new Error(
        "V2 registry entries may only advertise V2 payment sources. Legacy V1 sources cannot be listed on a V2 mint.",
      );
    }

    validateCardanoAddressForNetwork(
      supportedPaymentSource.address,
      expectedNetwork,
    );
  }
}

export function parseSupportedPaymentSourcesFromMetadata(
  value: unknown,
): SupportedPaymentSource[] | null {
  if (value == null) {
    return null;
  }

  const parsed = z.array(supportedPaymentSourceMetadataSchema).safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const reparsed = supportedPaymentSourcesSchema.safeParse(
    parsed.data.map((source) => {
      const chain = metadataToString(source.chain);
      const settlement = source.settlement ?? {};
      const pricingType = metadataToString(source.pricing?.pricingType);
      const pricing =
        pricingType === PricingType.Fixed
          ? {
              pricingType,
              fixed:
                source.pricing?.fixed?.map((price) => ({
                  asset: metadataToString(price.asset),
                  amount: metadataToString(price.amount),
                  decimals: parseMetadataDecimals(price.decimals),
                })) ?? [],
            }
          : pricingType === PricingType.Dynamic
            ? {
                pricingType,
                dynamic: source.pricing?.dynamic?.map((asset) => ({
                  asset: metadataToString(asset.asset),
                  decimals: parseMetadataDecimals(asset.decimals),
                })),
              }
            : { pricingType };
      if (chain === SupportedPaymentSourceChain.EVM) {
        return {
          chain,
          network: metadataToString(source.network),
          scheme: metadataToString(settlement.scheme),
          payTo: metadataToString(settlement.payTo),
          resource: metadataToString(settlement.resource),
          extra: settlement.extra,
          pricing,
        };
      }
      return {
        chain,
        network: metadataToString(source.network),
        paymentSourceType: metadataToString(settlement.paymentSourceType),
        address: metadataToString(settlement.address),
        pricing,
      };
    }),
  );
  return reparsed.success ? reparsed.data : null;
}
