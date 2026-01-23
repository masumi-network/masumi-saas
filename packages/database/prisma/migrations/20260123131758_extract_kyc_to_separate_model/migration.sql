-- CreateTable: KycVerification
CREATE TABLE "kyc_verification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "sumsubApplicantId" TEXT,
    "completedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_verification_userId_idx" ON "kyc_verification"("userId");
CREATE INDEX "kyc_verification_status_idx" ON "kyc_verification"("status");

-- Migrate existing KYC data from User to KycVerification
-- Only migrate users who have non-default KYC data
INSERT INTO "kyc_verification" ("id", "userId", "status", "sumsubApplicantId", "completedAt", "rejectionReason", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    COALESCE("kycStatus", 'PENDING'::"KycStatus"),
    "sumsubApplicantId",
    "kycCompletedAt",
    "kycRejectionReason",
    COALESCE("kycCompletedAt", "createdAt"),
    "updatedAt"
FROM "user"
WHERE "kycStatus" IS NOT NULL 
   OR "sumsubApplicantId" IS NOT NULL 
   OR "kycCompletedAt" IS NOT NULL 
   OR "kycRejectionReason" IS NOT NULL;

-- Add new column to User table
ALTER TABLE "user" ADD COLUMN "currentKycVerificationId" TEXT;

-- Set currentKycVerificationId for users who have KYC data
UPDATE "user" u
SET "currentKycVerificationId" = (
    SELECT kv."id" 
    FROM "kyc_verification" kv 
    WHERE kv."userId" = u."id" 
    ORDER BY kv."createdAt" DESC 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM "kyc_verification" kv WHERE kv."userId" = u."id"
);

-- AddForeignKey
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for currentKycVerification
ALTER TABLE "user" ADD CONSTRAINT "user_currentKycVerificationId_fkey" FOREIGN KEY ("currentKycVerificationId") REFERENCES "kyc_verification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old KYC columns from User table
ALTER TABLE "user" DROP COLUMN IF EXISTS "kycStatus";
ALTER TABLE "user" DROP COLUMN IF EXISTS "sumsubApplicantId";
ALTER TABLE "user" DROP COLUMN IF EXISTS "kycCompletedAt";
ALTER TABLE "user" DROP COLUMN IF EXISTS "kycRejectionReason";
