-- CreateEnum
CREATE TYPE "X402EvmWalletType" AS ENUM ('Purchasing', 'Selling');

-- CreateEnum
CREATE TYPE "X402PaymentScheme" AS ENUM ('Exact');

-- CreateEnum
CREATE TYPE "X402PaymentDirection" AS ENUM ('InboundVerify', 'InboundSettle', 'OutboundPayment');

-- CreateEnum
CREATE TYPE "X402PaymentStatus" AS ENUM ('PaymentRequired', 'Verified', 'Settled', 'Failed', 'Replayed');

-- CreateEnum
CREATE TYPE "LowBalanceStatus" AS ENUM ('Unknown', 'Healthy', 'Low');

-- CreateTable
CREATE TABLE "supported_payment_source" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "paymentSourceType" TEXT,
    "address" TEXT NOT NULL,
    "scheme" "X402PaymentScheme",
    "asset" TEXT,
    "amount" BIGINT,
    "decimals" INTEGER,
    "payTo" TEXT,
    "resource" TEXT,
    "extra" JSONB,

    CONSTRAINT "supported_payment_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402_network" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "caip2Id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "isTestnet" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultAsset" TEXT,
    "facilitatorWalletId" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "x402_network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402_evm_wallet" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "address" TEXT NOT NULL,
    "type" "X402EvmWalletType" NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,

    CONSTRAINT "x402_evm_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402_evm_wallet_low_balance_rule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "evmWalletId" TEXT NOT NULL,
    "caip2Network" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "thresholdAmount" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "LowBalanceStatus" NOT NULL DEFAULT 'Unknown',
    "lastKnownAmount" BIGINT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastAlertedAt" TIMESTAMP(3),

    CONSTRAINT "x402_evm_wallet_low_balance_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402_wallet_budget" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "orgApiKeyId" TEXT NOT NULL,
    "evmWalletId" TEXT NOT NULL,
    "caip2Network" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "remainingAmount" BIGINT NOT NULL,
    "spentAmount" BIGINT NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,

    CONSTRAINT "x402_wallet_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402_payment_attempt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "direction" "X402PaymentDirection" NOT NULL,
    "status" "X402PaymentStatus" NOT NULL,
    "userId" TEXT NOT NULL,
    "orgApiKeyId" TEXT,
    "evmWalletId" TEXT,
    "agentId" TEXT,
    "supportedPaymentSourceId" TEXT,
    "caip2Network" TEXT NOT NULL,
    "scheme" "X402PaymentScheme" NOT NULL DEFAULT 'Exact',
    "asset" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "payTo" TEXT NOT NULL,
    "payer" TEXT,
    "resource" TEXT,
    "paymentPayloadHash" TEXT,
    "paymentPayload" JSONB,
    "paymentIdentifier" TEXT,
    "errorReason" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "x402_payment_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402_settlement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "paymentPayloadHash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "txHash" TEXT,
    "caip2Network" TEXT NOT NULL,
    "amount" BIGINT,
    "payer" TEXT,
    "rawResponse" JSONB,

    CONSTRAINT "x402_settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supported_payment_source_address_idx" ON "supported_payment_source"("address");

-- CreateIndex
CREATE INDEX "supported_payment_source_paymentSourceType_idx" ON "supported_payment_source"("paymentSourceType");

-- CreateIndex
CREATE INDEX "supported_payment_source_chain_network_idx" ON "supported_payment_source"("chain", "network");

-- CreateIndex
CREATE INDEX "supported_payment_source_agentId_idx" ON "supported_payment_source"("agentId");

CREATE UNIQUE INDEX "supported_payment_source_cardano_unique_key"
ON "supported_payment_source"("agentId", "chain", "network", "paymentSourceType", "address")
WHERE "chain" = 'Cardano' AND "paymentSourceType" IS NOT NULL;

CREATE UNIQUE INDEX "supported_payment_source_x402_unique_key"
ON "supported_payment_source"(
  "agentId",
  "chain",
  "network",
  "scheme",
  "asset",
  "amount",
  "decimals",
  "payTo",
  COALESCE("resource", '')
)
WHERE "chain" = 'EVM' AND "scheme" IS NOT NULL AND "asset" IS NOT NULL AND "payTo" IS NOT NULL;

ALTER TABLE "supported_payment_source"
ADD CONSTRAINT "supported_payment_source_completeness_check" CHECK (
  ("chain" = 'Cardano' AND "paymentSourceType" IS NOT NULL)
  OR (
    "chain" = 'EVM'
    AND "scheme" IS NOT NULL
    AND "asset" IS NOT NULL
    AND "amount" IS NOT NULL
    AND "decimals" IS NOT NULL
    AND "payTo" IS NOT NULL
  )
);

-- CreateIndex
CREATE INDEX "x402_network_isEnabled_idx" ON "x402_network"("isEnabled");

-- CreateIndex
CREATE INDEX "x402_network_userId_idx" ON "x402_network"("userId");

-- CreateIndex
CREATE INDEX "x402_network_organizationId_idx" ON "x402_network"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "x402_network_userId_caip2Id_key" ON "x402_network"("userId", "caip2Id");

-- CreateIndex
CREATE INDEX "x402_evm_wallet_deletedAt_idx" ON "x402_evm_wallet"("deletedAt");

-- CreateIndex
CREATE INDEX "x402_evm_wallet_userId_idx" ON "x402_evm_wallet"("userId");

-- CreateIndex
CREATE INDEX "x402_evm_wallet_organizationId_idx" ON "x402_evm_wallet"("organizationId");

-- CreateIndex
CREATE INDEX "x402_evm_wallet_type_idx" ON "x402_evm_wallet"("type");

-- CreateIndex
CREATE UNIQUE INDEX "x402_evm_wallet_address_key" ON "x402_evm_wallet"("address");

-- CreateIndex
CREATE INDEX "x402_evm_wallet_low_balance_rule_evmWalletId_enabled_idx" ON "x402_evm_wallet_low_balance_rule"("evmWalletId", "enabled");

-- CreateIndex
CREATE INDEX "x402_evm_wallet_low_balance_rule_enabled_status_idx" ON "x402_evm_wallet_low_balance_rule"("enabled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "x402_evm_wallet_low_balance_rule_evmWalletId_caip2Network_a_key" ON "x402_evm_wallet_low_balance_rule"("evmWalletId", "caip2Network", "asset");

-- CreateIndex
CREATE INDEX "x402_wallet_budget_orgApiKeyId_enabled_idx" ON "x402_wallet_budget"("orgApiKeyId", "enabled");

-- CreateIndex
CREATE INDEX "x402_wallet_budget_evmWalletId_enabled_idx" ON "x402_wallet_budget"("evmWalletId", "enabled");

-- CreateIndex
CREATE INDEX "x402_wallet_budget_caip2Network_asset_idx" ON "x402_wallet_budget"("caip2Network", "asset");

-- CreateIndex
CREATE INDEX "x402_wallet_budget_createdByUserId_idx" ON "x402_wallet_budget"("createdByUserId");

-- CreateIndex
CREATE INDEX "x402_wallet_budget_userId_idx" ON "x402_wallet_budget"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "x402_wallet_budget_orgApiKeyId_evmWalletId_caip2Network_ass_key" ON "x402_wallet_budget"("orgApiKeyId", "evmWalletId", "caip2Network", "asset");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_userId_createdAt_idx" ON "x402_payment_attempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_orgApiKeyId_createdAt_idx" ON "x402_payment_attempt"("orgApiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_agentId_createdAt_idx" ON "x402_payment_attempt"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_supportedPaymentSourceId_idx" ON "x402_payment_attempt"("supportedPaymentSourceId");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_paymentIdentifier_idx" ON "x402_payment_attempt"("paymentIdentifier");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_caip2Network_asset_idx" ON "x402_payment_attempt"("caip2Network", "asset");

-- CreateIndex
CREATE INDEX "x402_payment_attempt_status_createdAt_idx" ON "x402_payment_attempt"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "x402_settlement_paymentAttemptId_key" ON "x402_settlement"("paymentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "x402_settlement_paymentPayloadHash_key" ON "x402_settlement"("paymentPayloadHash");

-- CreateIndex
CREATE INDEX "x402_settlement_txHash_idx" ON "x402_settlement"("txHash");

-- CreateIndex
CREATE INDEX "x402_settlement_caip2Network_idx" ON "x402_settlement"("caip2Network");

-- AddForeignKey
ALTER TABLE "supported_payment_source" ADD CONSTRAINT "supported_payment_source_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_network" ADD CONSTRAINT "x402_network_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_network" ADD CONSTRAINT "x402_network_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_network" ADD CONSTRAINT "x402_network_facilitatorWalletId_fkey" FOREIGN KEY ("facilitatorWalletId") REFERENCES "x402_evm_wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_evm_wallet" ADD CONSTRAINT "x402_evm_wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_evm_wallet" ADD CONSTRAINT "x402_evm_wallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_evm_wallet_low_balance_rule" ADD CONSTRAINT "x402_evm_wallet_low_balance_rule_evmWalletId_fkey" FOREIGN KEY ("evmWalletId") REFERENCES "x402_evm_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_wallet_budget" ADD CONSTRAINT "x402_wallet_budget_orgApiKeyId_fkey" FOREIGN KEY ("orgApiKeyId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_wallet_budget" ADD CONSTRAINT "x402_wallet_budget_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_wallet_budget" ADD CONSTRAINT "x402_wallet_budget_evmWalletId_fkey" FOREIGN KEY ("evmWalletId") REFERENCES "x402_evm_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_wallet_budget" ADD CONSTRAINT "x402_wallet_budget_userId_caip2Network_fkey" FOREIGN KEY ("userId", "caip2Network") REFERENCES "x402_network"("userId", "caip2Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_payment_attempt" ADD CONSTRAINT "x402_payment_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_payment_attempt" ADD CONSTRAINT "x402_payment_attempt_orgApiKeyId_fkey" FOREIGN KEY ("orgApiKeyId") REFERENCES "api_key"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_payment_attempt" ADD CONSTRAINT "x402_payment_attempt_evmWalletId_fkey" FOREIGN KEY ("evmWalletId") REFERENCES "x402_evm_wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_payment_attempt" ADD CONSTRAINT "x402_payment_attempt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_payment_attempt" ADD CONSTRAINT "x402_payment_attempt_supportedPaymentSourceId_fkey" FOREIGN KEY ("supportedPaymentSourceId") REFERENCES "supported_payment_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_payment_attempt" ADD CONSTRAINT "x402_payment_attempt_userId_caip2Network_fkey" FOREIGN KEY ("userId", "caip2Network") REFERENCES "x402_network"("userId", "caip2Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402_settlement" ADD CONSTRAINT "x402_settlement_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "x402_payment_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
