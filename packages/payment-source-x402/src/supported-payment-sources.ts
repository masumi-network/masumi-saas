import { type Prisma, X402PaymentScheme } from "@masumi/database";
import prisma from "@masumi/database/client";

import { logger } from "./logger.js";
import type { CardanoNetwork } from "./network.js";
import {
  PaymentSourceType,
  type SupportedPaymentSource,
  SupportedPaymentSourceChain,
} from "./payment-source.js";

type DbSupportedPaymentSource = {
  id: string;
  chain: string;
  network: string;
  paymentSourceType: string | null;
  address: string;
  scheme: X402PaymentScheme | null;
  asset: string | null;
  amount: bigint | null;
  decimals: number | null;
  payTo: string | null;
  resource: string | null;
  extra: Prisma.JsonValue | null;
};

function jsonObjectToRecord(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function serializeSupportedPaymentSources(
  sources: DbSupportedPaymentSource[],
): SupportedPaymentSource[] | null {
  if (sources.length === 0) return null;

  const serialized = sources.flatMap((source): SupportedPaymentSource[] => {
    if (source.chain === SupportedPaymentSourceChain.EVM) {
      if (
        source.scheme !== X402PaymentScheme.Exact ||
        source.asset == null ||
        source.amount == null ||
        source.decimals == null ||
        source.payTo == null
      ) {
        logger.error(
          "Skipping incomplete persisted x402 supported payment source",
          {
            network: source.network,
            address: source.address,
          },
        );
        return [];
      }
      return [
        {
          chain: SupportedPaymentSourceChain.EVM,
          network: source.network,
          paymentSourceType: null,
          address: source.address,
          scheme: "Exact",
          asset: source.asset,
          amount: source.amount.toString(),
          decimals: source.decimals,
          payTo: source.payTo,
          resource: source.resource ?? undefined,
          extra: jsonObjectToRecord(source.extra),
        },
      ];
    }

    if (source.paymentSourceType == null) {
      logger.error(
        "Skipping persisted Cardano supported payment source missing paymentSourceType",
        { network: source.network, address: source.address },
      );
      return [];
    }

    return [
      {
        chain: SupportedPaymentSourceChain.Cardano,
        network: source.network as CardanoNetwork,
        paymentSourceType: source.paymentSourceType as
          | typeof PaymentSourceType.Web3CardanoV1
          | typeof PaymentSourceType.Web3CardanoV2,
        address: source.address,
      },
    ];
  });

  return serialized.length === 0 ? null : serialized;
}

function toPrismaCreateRow(
  source: SupportedPaymentSource,
): Omit<Prisma.SupportedPaymentSourceCreateManyInput, "agentId"> {
  if (source.chain === SupportedPaymentSourceChain.EVM) {
    const payTo = source.payTo;
    return {
      chain: source.chain,
      network: source.network,
      paymentSourceType: null,
      address: source.address ?? payTo,
      scheme: X402PaymentScheme.Exact,
      asset: source.asset,
      amount: BigInt(source.amount),
      decimals: source.decimals,
      payTo,
      resource: source.resource ?? null,
      extra: source.extra ?? undefined,
    };
  }

  return {
    chain: source.chain,
    network: source.network,
    paymentSourceType: source.paymentSourceType,
    address: source.address,
    scheme: null,
    asset: null,
    amount: null,
    decimals: null,
    payTo: null,
    resource: null,
    extra: undefined,
  };
}

export async function replaceSupportedPaymentSourcesForAgent(
  agentId: string,
  sources: SupportedPaymentSource[],
): Promise<void> {
  await prisma.$transaction([
    prisma.supportedPaymentSource.deleteMany({ where: { agentId } }),
    prisma.supportedPaymentSource.createMany({
      data: sources.map((source) => ({
        ...toPrismaCreateRow(source),
        agentId,
      })),
    }),
  ]);
}

export async function loadSupportedPaymentSourcesForAgent(
  agentId: string,
): Promise<SupportedPaymentSource[] | null> {
  const rows = await prisma.supportedPaymentSource.findMany({
    where: { agentId },
    orderBy: { createdAt: "asc" },
  });
  return serializeSupportedPaymentSources(rows);
}

/** Batch-load advertised payment sources for agent API responses. */
export async function loadSupportedPaymentSourcesMap(
  agentIds: string[],
): Promise<Map<string, SupportedPaymentSource[] | null>> {
  const map = new Map<string, SupportedPaymentSource[] | null>();
  if (agentIds.length === 0) return map;

  const rows = await prisma.supportedPaymentSource.findMany({
    where: { agentId: { in: agentIds } },
    orderBy: { createdAt: "asc" },
  });

  const rowsByAgentId = new Map<string, DbSupportedPaymentSource[]>();
  for (const row of rows) {
    const bucket = rowsByAgentId.get(row.agentId) ?? [];
    bucket.push(row);
    rowsByAgentId.set(row.agentId, bucket);
  }

  for (const agentId of agentIds) {
    map.set(
      agentId,
      serializeSupportedPaymentSources(rowsByAgentId.get(agentId) ?? []),
    );
  }

  return map;
}

export function buildDefaultCardanoSupportedPaymentSource(
  network: CardanoNetwork,
  smartContractAddress: string,
): SupportedPaymentSource {
  return {
    chain: SupportedPaymentSourceChain.Cardano,
    network,
    paymentSourceType: PaymentSourceType.Web3CardanoV2,
    address: smartContractAddress,
  };
}

export function mergeWithDefaultCardanoSource(
  network: CardanoNetwork,
  smartContractAddress: string,
  sources: SupportedPaymentSource[],
): SupportedPaymentSource[] {
  const hasCardano = sources.some(
    (source) => source.chain === SupportedPaymentSourceChain.Cardano,
  );
  if (hasCardano) return sources;
  return [
    buildDefaultCardanoSupportedPaymentSource(network, smartContractAddress),
    ...sources,
  ];
}
