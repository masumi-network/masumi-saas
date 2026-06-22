-- CreateEnum
CREATE TYPE "AgentRuntimeProvider" AS ENUM ('DIRECT_MIP', 'LANGDOCK');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('LANGDOCK');

-- CreateEnum
CREATE TYPE "MipJobStatus" AS ENUM ('AWAITING_PAYMENT', 'RUNNING', 'AWAITING_INPUT', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "agent"
ADD COLUMN "runtimeProvider" "AgentRuntimeProvider" NOT NULL DEFAULT 'DIRECT_MIP',
ADD COLUMN "integrationConnectionId" TEXT,
ADD COLUMN "providerConfig" JSONB;

-- CreateTable
CREATE TABLE "integration_connection" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "name" TEXT NOT NULL,
  "encryptedSecret" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "integration_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mip_job" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" "MipJobStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "identifierFromPurchaser" TEXT NOT NULL,
  "inputData" JSONB NOT NULL,
  "inputHash" TEXT NOT NULL,
  "inputSchema" JSONB,
  "outputHash" TEXT,
  "result" TEXT,
  "blockchainIdentifier" TEXT,
  "agentIdentifier" TEXT,
  "sellerVKey" TEXT,
  "payByTime" TIMESTAMP(3),
  "submitResultTime" TIMESTAMP(3),
  "unlockTime" TIMESTAMP(3),
  "externalDisputeUnlockTime" TIMESTAMP(3),
  "conversation" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mip_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runtimeProvider_idx" ON "agent"("runtimeProvider");

-- CreateIndex
CREATE INDEX "agent_integrationConnectionId_idx" ON "agent"("integrationConnectionId");

-- CreateIndex
CREATE INDEX "integration_connection_userId_provider_idx" ON "integration_connection"("userId", "provider");

-- CreateIndex
CREATE INDEX "integration_connection_organizationId_provider_idx" ON "integration_connection"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "mip_job_agentId_status_idx" ON "mip_job"("agentId", "status");

-- CreateIndex
CREATE INDEX "mip_job_blockchainIdentifier_idx" ON "mip_job"("blockchainIdentifier");

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "integration_connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mip_job" ADD CONSTRAINT "mip_job_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
