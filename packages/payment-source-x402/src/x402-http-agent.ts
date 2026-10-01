import type { X402HttpProbeRow } from "./http-resource-probe.js";
import {
  buildEvmExactFixedPaymentSource,
  type EvmSupportedPaymentSource,
} from "./payment-source.js";

export type X402AgentManifest = {
  x402Version: number;
  resources: Array<{
    resource: string;
    type: "http" | "mcp";
    description?: string;
  }>;
};

/** Registry `extra` must mirror the live 402, not SaaS seller permit2 defaults. */
export function buildRegistryExtraFromProbeRow(
  row: X402HttpProbeRow,
): Record<string, unknown> {
  const extra = row.extra ?? {};
  const out: Record<string, unknown> = { decimals: row.decimals };
  if (typeof extra.name === "string") out.name = extra.name;
  if (typeof extra.version === "string") out.version = extra.version;
  if (typeof extra.assetTransferMethod === "string") {
    out.assetTransferMethod = extra.assetTransferMethod;
  }
  return out;
}

export function buildX402AgentManifestFromProbeRow(
  row: X402HttpProbeRow,
): X402AgentManifest {
  return {
    x402Version: row.x402Version ?? 2,
    resources: [
      {
        resource: row.resource,
        type: row.type === "mcp" ? "mcp" : "http",
        ...(row.description ? { description: row.description } : {}),
      },
    ],
  };
}

export function buildEvmPaymentSourceFromProbeRow(
  row: X402HttpProbeRow,
): EvmSupportedPaymentSource {
  if (row.scheme !== "exact") {
    throw new Error("Only exact scheme x402 resources are supported.");
  }
  if (!row.sokosumiCompatible) {
    throw new Error("Probe row is not Sokosumi-compatible.");
  }
  if (!row.amount) {
    throw new Error("Probe row is missing a fixed amount.");
  }
  return buildEvmExactFixedPaymentSource({
    network: row.network,
    payTo: row.payTo,
    asset: row.asset,
    amount: row.amount,
    decimals: row.decimals,
    resource: row.resource,
    extra: buildRegistryExtraFromProbeRow(row),
  });
}

/** Cardano registry mint network for a probed EVM network. */
export const CARDANO_NETWORK_BY_EVM: Record<string, "Mainnet" | "Preprod"> = {
  "eip155:8453": "Mainnet",
  "eip155:84532": "Preprod",
};

export function evmNetworkForCardanoPaymentNetwork(
  network: "Mainnet" | "Preprod",
): string {
  return network === "Mainnet" ? "eip155:8453" : "eip155:84532";
}
