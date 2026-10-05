import type { Prisma } from "@masumi/database";
import prisma from "@masumi/database/client";
import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";
import { replaceSupportedPaymentSourcesForAgent } from "@masumi/payment-source-x402/supported-payment-sources";

/**
 * Writes a new agent's supported payment sources, then its reference. A
 * reference marks the agent as submittable for on-chain registration, so the
 * sources must exist first. On a throw the agent row is deleted (rows written
 * here cascade with it), so credit refunds and retries start from a clean state.
 */
export async function persistAgentRegistrationSetup(params: {
  agentId: string;
  supportedPaymentSources: SupportedPaymentSource[] | null;
  reference: Omit<Prisma.AgentReferenceUncheckedCreateInput, "agentId">;
}): Promise<void> {
  try {
    if (params.supportedPaymentSources) {
      await replaceSupportedPaymentSourcesForAgent(
        params.agentId,
        params.supportedPaymentSources,
      );
    }
    await prisma.agentReference.create({
      data: { ...params.reference, agentId: params.agentId },
    });
  } catch (error) {
    await prisma.agent
      .delete({ where: { id: params.agentId } })
      .catch((deleteError: unknown) => {
        console.error(
          "Failed to delete agent after registration setup error:",
          { agentId: params.agentId },
          deleteError,
        );
      });
    throw error;
  }
}
