-- Preserve agent display name on lifecycle events when agent row is deleted (FK agentId set null).
ALTER TABLE "agent_activity_event" ADD COLUMN "agentNameSnapshot" TEXT;
