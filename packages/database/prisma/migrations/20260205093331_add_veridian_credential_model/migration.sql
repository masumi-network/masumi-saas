-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ISSUED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "veridian_credential" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "schemaSaid" TEXT NOT NULL,
    "aid" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ISSUED',
    "credentialData" TEXT,
    "attributes" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "organizationId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veridian_credential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "veridian_credential_userId_idx" ON "veridian_credential"("userId");

-- CreateIndex
CREATE INDEX "veridian_credential_agentId_idx" ON "veridian_credential"("agentId");

-- CreateIndex
CREATE INDEX "veridian_credential_organizationId_idx" ON "veridian_credential"("organizationId");

-- CreateIndex
CREATE INDEX "veridian_credential_aid_idx" ON "veridian_credential"("aid");

-- CreateIndex
CREATE INDEX "veridian_credential_schemaSaid_idx" ON "veridian_credential"("schemaSaid");

-- CreateIndex
CREATE INDEX "veridian_credential_status_idx" ON "veridian_credential"("status");

-- CreateIndex
CREATE INDEX "veridian_credential_credentialId_idx" ON "veridian_credential"("credentialId");

-- AddForeignKey
ALTER TABLE "veridian_credential" ADD CONSTRAINT "veridian_credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veridian_credential" ADD CONSTRAINT "veridian_credential_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veridian_credential" ADD CONSTRAINT "veridian_credential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
