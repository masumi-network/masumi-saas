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
 */
export async function recordAgentActivityEvent(
  agentId: string,
  type: AgentActivityEventType,
): Promise<void> {
  try {
    await prisma.agentActivityEvent.create({
      data: { agentId, type },
    });
  } catch (err) {
    console.error("[Activity] Failed to record event:", type, agentId, err);
  }
}
