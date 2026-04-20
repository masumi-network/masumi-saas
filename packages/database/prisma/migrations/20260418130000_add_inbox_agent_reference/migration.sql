-- CreateTable
CREATE TABLE "inbox_agent_reference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentNodeId" TEXT NOT NULL,
    "networkIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "agentSlug" TEXT NOT NULL,
    "state" "RegistrationState" NOT NULL DEFAULT 'RegistrationRequested',
    "agentIdentifier" TEXT,
    "executingWalletId" TEXT NOT NULL,
    "executingWalletVkey" TEXT NOT NULL,
    "executingWalletAddress" TEXT NOT NULL,
    "smartContractAddress" TEXT,
    "registryEntry" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_agent_reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_agent_reference_networkIdentifier_paymentNodeId_key" ON "inbox_agent_reference"("networkIdentifier", "paymentNodeId");

-- CreateIndex
CREATE INDEX "inbox_agent_reference_userId_networkIdentifier_idx" ON "inbox_agent_reference"("userId", "networkIdentifier");

-- CreateIndex
CREATE INDEX "inbox_agent_reference_userId_networkIdentifier_state_idx" ON "inbox_agent_reference"("userId", "networkIdentifier", "state");

-- CreateIndex
CREATE INDEX "inbox_agent_reference_paymentNodeId_idx" ON "inbox_agent_reference"("paymentNodeId");

-- CreateIndex
CREATE INDEX "inbox_agent_reference_agentIdentifier_idx" ON "inbox_agent_reference"("agentIdentifier");

-- AddForeignKey
ALTER TABLE "inbox_agent_reference" ADD CONSTRAINT "inbox_agent_reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
