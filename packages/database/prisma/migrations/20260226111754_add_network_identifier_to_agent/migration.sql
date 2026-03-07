-- AlterTable
ALTER TABLE "agent" ADD COLUMN     "networkIdentifier" TEXT;

-- CreateIndex
CREATE INDEX "agent_networkIdentifier_idx" ON "agent"("networkIdentifier");
