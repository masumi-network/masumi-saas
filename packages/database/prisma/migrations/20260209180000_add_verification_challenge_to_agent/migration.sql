-- AlterTable
ALTER TABLE "agent" ADD COLUMN "verificationChallenge" TEXT,
ADD COLUMN "verificationChallengeGeneratedAt" TIMESTAMP(3);
