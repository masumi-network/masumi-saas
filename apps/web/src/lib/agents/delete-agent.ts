import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";

export type DeleteAgentResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Deletes an agent owned by `userId`, tearing down its payment-node registry
 * entry when present.
 *
 * SECURITY: `userId` MUST be the authenticated caller's id, resolved from a
 * trusted source (session or verified API context) — never a client-supplied
 * value. Ownership is enforced via `getWalletOwnedAgentForUser`, but that check
 * is only meaningful when `userId` itself is trusted.
 */
export async function deleteAgentForUser(params: {
  userId: string;
  agentId: string;
}): Promise<DeleteAgentResult> {
  const { userId, agentId } = params;
  try {
    const agent = await getWalletOwnedAgentForUser({ userId, agentId });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    const hasExternalRegistration = Boolean(agent.agentReference?.externalId);

    if (!hasExternalRegistration) {
      // Legacy agent (created via old POST /api/agents): no payment-node entry;
      // allow direct delete so the user can remove it.
      await recordAgentActivityEvent(agentId, "AgentDeleted");
      await prisma.agent.delete({ where: { id: agentId } });
      return { success: true };
    }

    const liveStates: (typeof agent.registrationState)[] = [
      "RegistrationConfirmed",
      "RegistrationRequested",
      "RegistrationInitiated",
      "DeregistrationRequested",
      "DeregistrationInitiated",
    ];
    const isLegacyConfirmed =
      agent.registrationState === "RegistrationConfirmed" &&
      !agent.agentIdentifier;
    if (liveStates.includes(agent.registrationState) && !isLegacyConfirmed) {
      return {
        success: false,
        error:
          "This agent is still active. Please deregister it before deleting.",
      };
    }

    const externalId = agent.agentReference!.externalId;
    if (!externalId) {
      return { success: false, error: "No externalId found for this agent." };
    }
    const baseUrl = paymentNodeConfig.getBaseUrl();
    const adminKey = paymentNodeConfig.getAdminApiKey();
    const adminClient = createPaymentNodeClient(baseUrl, adminKey);
    await adminClient.deleteRegistryEntry(externalId);

    await recordAgentActivityEvent(agentId, "AgentDeleted");
    await prisma.agent.delete({ where: { id: agentId } });

    return { success: true };
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete agent",
    };
  }
}
