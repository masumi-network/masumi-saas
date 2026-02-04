-- CreateTable
CREATE TABLE "agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" DEFAULT 'PENDING',
    "veridianCredentialId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_userId_idx" ON "agent"("userId");

-- CreateIndex
CREATE INDEX "agent_verificationStatus_idx" ON "agent"("verificationStatus");

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
