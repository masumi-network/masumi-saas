import type { PaymentNodeClient } from "@/lib/payment-node/client";
import type { PaymentNodeNetwork } from "@/lib/payment-node/schemas";

import { getSmartContractAddressForConfiguredSource } from "./resolve-smart-contract";

const POLICY_ID_HEX_LENGTH = 56;
const MAX_PAYMENT_SOURCE_PAGES = 5;
const PAYMENT_SOURCE_PAGE_SIZE = 100;

export type AgentReferenceDeregisterMeta = {
  smartContractAddress?: string;
  paymentSourceId?: string;
};

export function extractPolicyIdFromAgentIdentifier(
  agentIdentifier: string,
): string | null {
  if (agentIdentifier.length < POLICY_ID_HEX_LENGTH) {
    return null;
  }
  return agentIdentifier.slice(0, POLICY_ID_HEX_LENGTH);
}

async function listAllPaymentSources(client: PaymentNodeClient) {
  const sources: Awaited<
    ReturnType<PaymentNodeClient["getPaymentSources"]>
  >["PaymentSources"] = [];
  let cursorId: string | undefined;

  for (let page = 0; page < MAX_PAYMENT_SOURCE_PAGES; page += 1) {
    const result = await client.getPaymentSources({
      take: PAYMENT_SOURCE_PAGE_SIZE,
      cursorId,
    });
    sources.push(...result.PaymentSources);
    if (result.PaymentSources.length < PAYMENT_SOURCE_PAGE_SIZE) {
      break;
    }
    const nextCursor = result.PaymentSources.at(-1)?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return sources;
}

/**
 * Resolve the Cardano smart-contract address for deregister.
 *
 * Priority matches payment-node deregister semantics:
 * 1) persisted AgentReference metadata
 * 2) payment source id from registration metadata
 * 3) registry policy id embedded in agentIdentifier (required when multiple
 *    payment sources share a network)
 * 4) SaaS env-configured default payment source
 */
export async function resolveSmartContractAddressForDeregister(
  client: PaymentNodeClient,
  userId: string,
  network: PaymentNodeNetwork,
  agentIdentifier: string,
  refMeta: AgentReferenceDeregisterMeta,
): Promise<string | null> {
  const fromMeta = refMeta.smartContractAddress?.trim();
  if (fromMeta) return fromMeta;

  const sources = await listAllPaymentSources(client);

  const paymentSourceId = refMeta.paymentSourceId?.trim();
  if (paymentSourceId) {
    const match = sources.find((source) => source.id === paymentSourceId);
    if (match?.smartContractAddress) {
      return match.smartContractAddress;
    }
  }

  const policyId = extractPolicyIdFromAgentIdentifier(agentIdentifier);
  if (policyId) {
    const match = sources.find(
      (source) =>
        source.network === network &&
        source.policyId?.toLowerCase() === policyId,
    );
    if (match?.smartContractAddress) {
      return match.smartContractAddress;
    }
  }

  return getSmartContractAddressForConfiguredSource(client, userId, network);
}
