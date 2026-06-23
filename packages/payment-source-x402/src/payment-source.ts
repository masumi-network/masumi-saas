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

const cardanoNetworkSchema = z.enum(["Mainnet", "Preprod"]);

const paymentSourceTypeSchema = z.enum([
  PaymentSourceType.Web3CardanoV1,
  PaymentSourceType.Web3CardanoV2,
]);

const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address");

const cardanoSupportedPaymentSourceSchema = z.object({
  chain: z.literal(SupportedPaymentSourceChain.Cardano),
  network: cardanoNetworkSchema,
  paymentSourceType: paymentSourceTypeSchema,
  address: z.string().max(250),
});

const x402SupportedPaymentSourceSchema = z
  .object({
    chain: z.literal(SupportedPaymentSourceChain.EVM),
    network: z
      .string()
      .regex(
        /^eip155:\d+$/,
        "x402 EVM network must be a CAIP-2 eip155 chain id",
      ),
    paymentSourceType: paymentSourceTypeSchema.nullable().optional(),
    address: evmAddressSchema.optional(),
    scheme: z.literal("Exact"),
    asset: evmAddressSchema,
    amount: z.string().regex(/^\d+$/),
    decimals: z.number().int().min(0).max(255),
    payTo: evmAddressSchema,
    resource: z.string().url().max(500).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((source, ctx) => {
    if (
      source.address != null &&
      source.address.toLowerCase() !== source.payTo.toLowerCase()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address"],
        message: "x402 address alias must match payTo",
      });
    }
  });

export const supportedPaymentSourceSchema = z.discriminatedUnion("chain", [
  cardanoSupportedPaymentSourceSchema,
  x402SupportedPaymentSourceSchema,
]);

export const MAX_SUPPORTED_PAYMENT_SOURCES = 25;

export const supportedPaymentSourcesSchema = z
  .array(supportedPaymentSourceSchema)
  .min(1)
  .max(MAX_SUPPORTED_PAYMENT_SOURCES);

export type SupportedPaymentSource = z.infer<
  typeof supportedPaymentSourceSchema
>;

const metadataStringSchema = z.string().or(z.array(z.string()).min(1));

function metadataToString(value: string | string[] | undefined) {
  if (value == undefined) return undefined;
  if (typeof value === "string") return value;
  return value.join("");
}

const supportedPaymentSourceMetadataAmountSchema = z.object({
  asset: metadataStringSchema,
  amount: metadataStringSchema,
  decimals: metadataStringSchema.optional(),
});

const supportedPaymentSourceMetadataPricingSchema = z.object({
  pricingType: metadataStringSchema,
  fixed: z.array(supportedPaymentSourceMetadataAmountSchema).optional(),
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
    return {
      ...source,
      address: source.address ?? source.payTo,
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
      if (BigInt(supportedPaymentSource.amount) <= 0n) {
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
      const fixed = source.pricing?.fixed?.[0];
      if (chain === SupportedPaymentSourceChain.EVM) {
        const decimals = metadataToString(fixed?.decimals);
        return {
          chain,
          network: metadataToString(source.network),
          scheme: metadataToString(settlement.scheme),
          asset: metadataToString(fixed?.asset),
          amount: metadataToString(fixed?.amount),
          decimals: decimals != null ? Number(decimals) : undefined,
          payTo: metadataToString(settlement.payTo),
          resource: metadataToString(settlement.resource),
          extra: settlement.extra,
        };
      }
      return {
        chain,
        network: metadataToString(source.network),
        paymentSourceType: metadataToString(settlement.paymentSourceType),
        address: metadataToString(settlement.address),
      };
    }),
  );
  return reparsed.success ? reparsed.data : null;
}
