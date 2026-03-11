import prisma from "@masumi/database/client";

/** Agent activity event type; must match Prisma enum AgentActivityEventType */
type AgentActivityEventType =
  | "RegistrationInitiated"
  | "RegistrationConfirmed"
  | "RegistrationFailed"
  | "DeregistrationRequested"
  | "DeregistrationConfirmed"
  | "AgentVerified"
  | "AgentDeleted";

/**
 * Record an agent lifecycle event for the Activity feed.
 * Fire-and-forget: we don't fail the main flow if this fails.
 * Uses the agent's owner (userId) so events survive when the agent is deleted (agentId set to null).
 */
export async function recordAgentActivityEvent(
  agentId: string,
  type: AgentActivityEventType,
): Promise<void> {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true },
    });
    if (!agent) {
      console.error("[Activity] Agent not found for event:", type, agentId);
      return;
    }
    await prisma.agentActivityEvent.create({
      data: { agentId, userId: agent.userId, type },
    });
  } catch (err) {
    console.error("[Activity] Failed to record event:", type, agentId, err);
  }
}
