import prisma from "@masumi/database/client";

/**
 * Whether a registration credit may be refunded after startAgentRegistration
 * threw. Once the agent reference exists, complete-registration can still
 * submit the agent on-chain, so the credit must stay consumed. An agent row
 * without a reference can never be submitted, so it is refundable.
 */
export async function canRefundCreditAfterRegistrationThrow(
  agentId: string,
): Promise<boolean> {
  const reference = await prisma.agentReference.findUnique({
    where: { agentId },
    select: { agentId: true },
  });
  return !reference;
}
