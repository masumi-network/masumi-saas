import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";

/**
 * Deregister an agent on the payment node and update DB. Caller must have already
 * authenticated and verified that the agent belongs to the given user.
 * When the agent has no stored network, options.networkFallback is used (e.g. from
 * request cookies); pass it when calling from a Route Handler so the core stays
 * request-agnostic.
 */
export async function deregisterAgentForUser(
  agentId: string,
  userId: string,
  options?: { networkFallback?: PaymentNodeNetwork },
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
      include: { agentReference: true },
    });
    if (!agent) {
      return { success: false, error: "Agent not found" };
    }
    const canDeregister =
      agent.registrationState === "RegistrationConfirmed" ||
      agent.registrationState === "DeregistrationFailed";
    if (!canDeregister) {
      return {
        success: false,
        error:
          "Agent must be registered on the network before it can be deregistered.",
      };
    }
    const agentIdentifier =
      agent.agentIdentifier ??
      (agent.agentReference?.metadata as { agentIdentifier?: string } | null)
        ?.agentIdentifier;
    if (!agentIdentifier) {
      return {
        success: false,
        error: "Agent is not registered on the network",
      };
    }

    const userClient = await getPaymentNodeClientForUser(userId);
    if (!userClient) {
      return {
        success: false,
        error: "Something went wrong. Please try again.",
      };
    }

    const network = (agent.agentReference?.networkIdentifier ??
      options?.networkFallback ??
      DEFAULT_NETWORK) as PaymentNodeNetwork;
    await userClient.deregisterAgent({ network, agentIdentifier });

    await prisma.agent.update({
      where: { id: agentId },
      data: { registrationState: "DeregistrationRequested" },
    });

    await recordAgentActivityEvent(agentId, "DeregistrationRequested");

    return { success: true };
  } catch (error) {
    console.error("Failed to deregister agent:", error);
    const message =
      error instanceof Error ? error.message : "Failed to deregister agent";
    if (/^\d{3}:/.test(message)) {
      const status = message.slice(0, 3);
      if (status === "404") {
        return {
          success: false,
          error:
            "Registration not found on the network. It may already be deregistered.",
        };
      }
      return {
        success: false,
        error:
          "The registration service is temporarily unavailable. Please try again later.",
      };
    }
    return {
      success: false,
      error: message || "Failed to deregister agent",
    };
  }
}
