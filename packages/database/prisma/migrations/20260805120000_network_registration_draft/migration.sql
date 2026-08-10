-- CreateEnum
CREATE TYPE "NetworkRegistrationDraftStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "network_registration_draft" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NetworkRegistrationDraftStatus" NOT NULL DEFAULT 'PENDING',
    "agentId" TEXT,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "network_registration_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "network_registration_draft_email_idx" ON "network_registration_draft"("email");

-- CreateIndex
CREATE INDEX "network_registration_draft_status_expiresAt_idx" ON "network_registration_draft"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "network_registration_draft" ADD CONSTRAINT "network_registration_draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
