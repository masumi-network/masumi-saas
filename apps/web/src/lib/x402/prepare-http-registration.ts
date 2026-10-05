import {
  buildEvmPaymentSourceFromProbeRow,
  buildX402AgentManifestFromProbeRow,
  evmNetworkForCardanoPaymentNetwork,
  probeX402HttpResource,
  type X402AgentManifest,
  type X402HttpProbeRow,
} from "@masumi/payment-source-x402";
import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";

import type { PaymentNodeNetwork } from "@/lib/payment-node";

export type PreparedX402HttpRegistration = {
  resourceUrl: string;
  probeRow: X402HttpProbeRow;
  x402Manifest: X402AgentManifest;
  supportedPaymentSources: SupportedPaymentSource[];
};

export async function prepareX402HttpRegistration(input: {
  resourceUrl: string;
  network: PaymentNodeNetwork;
  /** Defaults to the probe's own timeout (60s). */
  probeTimeoutMs?: number;
}): Promise<
  | { ok: true; data: PreparedX402HttpRegistration }
  | { ok: false; error: string }
> {
  const trimmed = input.resourceUrl.trim();
  const evmNetwork = evmNetworkForCardanoPaymentNetwork(input.network);
  const probe = await probeX402HttpResource({
    resourceUrl: trimmed,
    evmNetwork,
    timeoutMs: input.probeTimeoutMs,
  });
  if (!probe.ok) {
    return { ok: false, error: probe.error };
  }

  try {
    const supportedPaymentSources = [
      buildEvmPaymentSourceFromProbeRow(probe.row),
    ];
    const x402Manifest = buildX402AgentManifestFromProbeRow(probe.row);
    return {
      ok: true,
      data: {
        resourceUrl: probe.row.resource,
        probeRow: probe.row,
        x402Manifest,
        supportedPaymentSources,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid x402 probe row.",
    };
  }
}
