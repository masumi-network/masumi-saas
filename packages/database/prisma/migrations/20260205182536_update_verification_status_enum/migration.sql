-- AlterEnum
-- First, add new enum values
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Update existing agent data: APPROVED -> VERIFIED, REJECTED -> REVOKED, REVIEW -> PENDING
-- Note: We do NOT update kyc_verification data as it still uses the old status values
UPDATE "agent" SET "verificationStatus" = 'VERIFIED' WHERE "verificationStatus" = 'APPROVED';
UPDATE "agent" SET "verificationStatus" = 'REVOKED' WHERE "verificationStatus" = 'REJECTED';
UPDATE "agent" SET "verificationStatus" = 'PENDING' WHERE "verificationStatus" = 'REVIEW';

-- Remove old enum values (PostgreSQL doesn't support removing enum values directly)
-- We'll need to recreate the enum type
-- This is a destructive operation, so we do it carefully
DO $$ 
BEGIN
    -- Create new enum without old values
    CREATE TYPE "VerificationStatus_new" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED', 'EXPIRED');
    
    -- Alter tables to use new enum
    ALTER TABLE "kyc_verification" ALTER COLUMN "status" TYPE "VerificationStatus_new" USING "status"::text::"VerificationStatus_new";
    ALTER TABLE "agent" ALTER COLUMN "verificationStatus" TYPE "VerificationStatus_new" USING "verificationStatus"::text::"VerificationStatus_new";
    
    -- Drop old enum and rename new one
    DROP TYPE "VerificationStatus";
    ALTER TYPE "VerificationStatus_new" RENAME TO "VerificationStatus";
END $$;
