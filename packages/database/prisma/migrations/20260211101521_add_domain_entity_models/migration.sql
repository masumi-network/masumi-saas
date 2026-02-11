-- Migration: add_domain_entity_models
-- Adds 6 new domain tables + 3 enums for org API keys, KYC/KYB submissions,
-- Stripe payment methods, wallet caching, and agent registry references.

-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('CARDANO', 'VERIDIAN');

-- CreateEnum
CREATE TYPE "WalletConnectionState" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "AgentReferenceStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'DEREGISTERED');

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kycVerificationId" TEXT NOT NULL,
    "sumsubApplicantId" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyb_submission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kybVerificationId" TEXT NOT NULL,
    "sumsubApplicantId" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyb_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_payment_method" (
    "id" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "last4" TEXT,
    "brand" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletType" "WalletType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "label" TEXT,
    "networkId" TEXT,
    "connectionState" "WalletConnectionState",
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_reference" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "registryUrl" TEXT,
    "externalId" TEXT,
    "networkIdentifier" TEXT,
    "registeredAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "status" "AgentReferenceStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_key_keyHash_key" ON "api_key"("keyHash");

-- CreateIndex
CREATE INDEX "api_key_organizationId_idx" ON "api_key"("organizationId");

-- CreateIndex
CREATE INDEX "api_key_createdById_idx" ON "api_key"("createdById");

-- CreateIndex (Compound: API key usage tracking)
CREATE INDEX "api_key_organizationId_enabled_lastUsedAt_idx" ON "api_key"("organizationId", "enabled", "lastUsedAt");

-- CreateIndex
CREATE INDEX "kyc_submission_userId_idx" ON "kyc_submission"("userId");

-- CreateIndex
CREATE INDEX "kyc_submission_kycVerificationId_idx" ON "kyc_submission"("kycVerificationId");

-- CreateIndex
CREATE INDEX "kyc_submission_status_idx" ON "kyc_submission"("status");

-- CreateIndex (Compound: verification status queries)
CREATE INDEX "kyc_submission_userId_status_createdAt_idx" ON "kyc_submission"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "kyb_submission_organizationId_idx" ON "kyb_submission"("organizationId");

-- CreateIndex
CREATE INDEX "kyb_submission_kybVerificationId_idx" ON "kyb_submission"("kybVerificationId");

-- CreateIndex
CREATE INDEX "kyb_submission_status_idx" ON "kyb_submission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_payment_method_stripePaymentMethodId_key" ON "stripe_payment_method"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "stripe_payment_method_userId_idx" ON "stripe_payment_method"("userId");

-- CreateIndex
CREATE INDEX "stripe_payment_method_organizationId_idx" ON "stripe_payment_method"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_cache_userId_walletType_identifier_key" ON "wallet_cache"("userId", "walletType", "identifier");

-- CreateIndex
CREATE INDEX "wallet_cache_userId_idx" ON "wallet_cache"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_reference_agentId_key" ON "agent_reference"("agentId");

-- CreateIndex
CREATE INDEX "agent_reference_externalId_idx" ON "agent_reference"("externalId");

-- CreateIndex
CREATE INDEX "agent_reference_networkIdentifier_idx" ON "agent_reference"("networkIdentifier");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submission" ADD CONSTRAINT "kyc_submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submission" ADD CONSTRAINT "kyc_submission_kycVerificationId_fkey" FOREIGN KEY ("kycVerificationId") REFERENCES "kyc_verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyb_submission" ADD CONSTRAINT "kyb_submission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyb_submission" ADD CONSTRAINT "kyb_submission_kybVerificationId_fkey" FOREIGN KEY ("kybVerificationId") REFERENCES "kyb_verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payment_method" ADD CONSTRAINT "stripe_payment_method_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payment_method" ADD CONSTRAINT "stripe_payment_method_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_cache" ADD CONSTRAINT "wallet_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reference" ADD CONSTRAINT "agent_reference_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddConstraint
-- Ensures every payment method is owned by exactly one of: a user or an organization (not neither, not both).
ALTER TABLE "stripe_payment_method"
ADD CONSTRAINT "stripe_payment_method_owner_check"
CHECK (num_nonnulls("userId", "organizationId") = 1);
