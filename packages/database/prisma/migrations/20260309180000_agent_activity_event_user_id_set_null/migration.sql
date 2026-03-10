-- Add userId so AgentDeleted events can be queried after agent is deleted (agentId set to null).
-- Change agentId FK to ON DELETE SET NULL so deleting an agent does not remove its activity events.

-- Add userId column (nullable temporarily for backfill)
ALTER TABLE "agent_activity_event" ADD COLUMN "userId" TEXT;

-- Backfill userId from agent
UPDATE "agent_activity_event" SET "userId" = "agent"."userId"
FROM "agent" WHERE "agent"."id" = "agent_activity_event"."agentId";

-- Enforce NOT NULL (no orphan rows expected)
ALTER TABLE "agent_activity_event" ALTER COLUMN "userId" SET NOT NULL;

-- Add FK to user
ALTER TABLE "agent_activity_event" ADD CONSTRAINT "agent_activity_event_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for feed queries by userId
CREATE INDEX "agent_activity_event_userId_idx" ON "agent_activity_event"("userId");

-- Drop existing agent FK (CASCADE)
ALTER TABLE "agent_activity_event" DROP CONSTRAINT IF EXISTS "agent_activity_event_agentId_fkey";

-- Make agentId nullable
ALTER TABLE "agent_activity_event" ALTER COLUMN "agentId" DROP NOT NULL;

-- Re-add agent FK with SET NULL so events survive agent delete
ALTER TABLE "agent_activity_event" ADD CONSTRAINT "agent_activity_event_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
