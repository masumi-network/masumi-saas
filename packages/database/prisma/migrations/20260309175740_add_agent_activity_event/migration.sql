-- CreateEnum
CREATE TYPE "AgentActivityEventType" AS ENUM ('RegistrationInitiated', 'RegistrationConfirmed', 'RegistrationFailed', 'DeregistrationRequested', 'DeregistrationConfirmed', 'AgentVerified', 'AgentDeleted');

-- CreateTable
CREATE TABLE "agent_activity_event" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" "AgentActivityEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_activity_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_activity_event_agentId_idx" ON "agent_activity_event"("agentId");

-- CreateIndex
CREATE INDEX "agent_activity_event_createdAt_idx" ON "agent_activity_event"("createdAt");

-- CreateIndex
CREATE INDEX "agent_activity_event_type_idx" ON "agent_activity_event"("type");

-- AddForeignKey
ALTER TABLE "agent_activity_event" ADD CONSTRAINT "agent_activity_event_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
