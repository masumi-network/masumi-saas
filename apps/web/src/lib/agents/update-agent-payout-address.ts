import "server-only";

import prisma from "@masumi/database/client";

import { getAgentPayoutAddress } from "@/lib/agents/agent-reference-metadata";
import {
  AGENT_REFERENCE_UPDATE_TIMEOUT_MS,
  lockAgentReference,
} from "@/lib/agents/agent-reference-updates";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import {
  normalizePayoutAddress,
  validatePayoutAddressForNetwork,
} from "@/lib/payment-node/payout-address";
import { agentPricingRequiresPayoutAddress } from "@/lib/schemas/agent";

function getAgentNetwork(agent: {
  networkIdentifier: string | null;
  agentReference?: { networkIdentifier: string | null } | null;
}): PaymentNodeNetwork {
  const network =
    agent.agentReference?.networkIdentifier ?? agent.networkIdentifier;
  return network === "Mainnet" ? "Mainnet" : "Preprod";
}

export async function updateAgentPayoutAddress(params: {
  userId: string;
  agentId: string;
  payoutAddress: string;
}): Promise<
  { success: true; payoutAddress: string } | { success: false; error: string }
> {
  // Serialize concurrent payout-address changes for the same agent under a
  // per-agent advisory lock. patchWallet (the authoritative on-chain money
  // route) has no compare-and-swap, so without this a double-submit could land
  // two patches in nondeterministic order and leave the DB mirror pointing at a
  // different address than the wallet actually collects to.
  return prisma.$transaction(
    async (tx) => {
      await lockAgentReference(tx, params.agentId);

      const agent = await tx.agent.findFirst({
        where: { id: params.agentId, userId: params.userId },
        include: { agentReference: true },
      });

      if (!agent?.agentReference) {
        return { success: false as const, error: "Agent not found." };
      }

      if (
        !agentPricingRequiresPayoutAddress(
          agent.pricing as { pricingType?: string } | null,
        )
      ) {
        return {
          success: false as const,
          error: "Free agents do not use a payout address.",
        };
      }

      const network = getAgentNetwork(agent);
      const normalized = normalizePayoutAddress(params.payoutAddress);
      const validationError = validatePayoutAddressForNetwork(
        normalized,
        network,
      );
      if (validationError) {
        return { success: false as const, error: validationError };
      }

      const sellingWalletId = agent.agentReference.sellingWalletId;
      if (!sellingWalletId) {
        return {
          success: false as const,
          error: "This agent does not have a selling wallet yet.",
        };
      }

      const currentPayoutAddress = getAgentPayoutAddress(agent);
      if (currentPayoutAddress === normalized) {
        return { success: true as const, payoutAddress: normalized };
      }

      const adminClient = tryCreateAdminPaymentNodeClient();
      if (!adminClient) {
        return {
          success: false as const,
          error: "Payment node is unavailable. Please try again later.",
        };
      }

      try {
        await adminClient.patchWallet({
          id: sellingWalletId,
          newCollectionAddress: normalized,
        });
      } catch (error) {
        console.error("[Payment Node] Failed to update agent payout address:", {
          agentId: params.agentId,
          sellingWalletId,
          error,
        });
        return {
          success: false as const,
          error: "Could not update the payout address. Please try again.",
        };
      }

      const existingMeta =
        agent.agentReference.metadata &&
        typeof agent.agentReference.metadata === "object" &&
        !Array.isArray(agent.agentReference.metadata)
          ? (agent.agentReference.metadata as Record<string, unknown>)
          : {};

      // The payment-node patch above is the authoritative, money-routing change
      // and has already succeeded. The agentReference metadata is a local
      // mirror; if this write fails, log it but still report success rather than
      // a 500 that hides the fact that the on-chain payout address was updated.
      // The mirror re-syncs on next read.
      try {
        await tx.agentReference.update({
          where: { agentId: agent.id },
          data: {
            metadata: {
              ...existingMeta,
              collectionAddress: normalized,
            },
          },
        });
      } catch (error) {
        console.error(
          "[Payment Node] Payout address updated on-chain but failed to mirror to agentReference metadata:",
          {
            agentId: params.agentId,
            sellingWalletId,
            error,
          },
        );
      }

      return { success: true as const, payoutAddress: normalized };
    },
    { timeout: AGENT_REFERENCE_UPDATE_TIMEOUT_MS },
  );
}
