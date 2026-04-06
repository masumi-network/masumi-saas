-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "amountUsd" DECIMAL(18,2) NOT NULL,
    "network" TEXT NOT NULL,
    "payoutAddress" TEXT NOT NULL,
    "destinationLabel" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_userId_idx" ON "withdrawal"("userId");

-- CreateIndex
CREATE INDEX "withdrawal_userId_status_idx" ON "withdrawal"("userId", "status");

-- CreateIndex
CREATE INDEX "withdrawal_createdAt_idx" ON "withdrawal"("createdAt");

-- AddForeignKey
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
