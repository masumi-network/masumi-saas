-- AlterTable
ALTER TABLE "agent" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "agent_organizationId_idx" ON "agent"("organizationId");

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
