-- Scope lifecycle orphans to payment network; align with agent.networkIdentifier.
ALTER TABLE "agent_activity_event" ADD COLUMN "networkIdentifier" TEXT;

CREATE INDEX "agent_activity_event_networkIdentifier_idx" ON "agent_activity_event"("networkIdentifier");
