-- AlterEnum (step 2/2): Migrate data and swap enum to drop old values.
-- Update existing data: APPROVED -> VERIFIED, REJECTED -> REVOKED, REVIEW -> PENDING
UPDATE "kyc_verification" SET status = 'VERIFIED' WHERE status = 'APPROVED';
UPDATE "kyc_verification" SET status = 'REVOKED' WHERE status = 'REJECTED';
UPDATE "kyc_verification" SET status = 'PENDING' WHERE status = 'REVIEW';

UPDATE "kyb_verification" SET status = 'VERIFIED' WHERE status = 'APPROVED';
UPDATE "kyb_verification" SET status = 'REVOKED' WHERE status = 'REJECTED';
UPDATE "kyb_verification" SET status = 'PENDING' WHERE status = 'REVIEW';

UPDATE "agent" SET "verificationStatus" = 'VERIFIED' WHERE "verificationStatus" = 'APPROVED';
UPDATE "agent" SET "verificationStatus" = 'REVOKED' WHERE "verificationStatus" = 'REJECTED';
UPDATE "agent" SET "verificationStatus" = 'PENDING' WHERE "verificationStatus" = 'REVIEW';

-- Recreate enum with only the new values (PostgreSQL cannot remove enum values directly)
-- Drop defaults so the type change can be applied, then restore them.
DO $$
BEGIN
    ALTER TABLE "kyc_verification" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "kyb_verification" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "agent" ALTER COLUMN "verificationStatus" DROP DEFAULT;

    CREATE TYPE "VerificationStatus_new" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED', 'EXPIRED');

    ALTER TABLE "kyc_verification" ALTER COLUMN "status" TYPE "VerificationStatus_new" USING "status"::text::"VerificationStatus_new";
    ALTER TABLE "kyb_verification" ALTER COLUMN "status" TYPE "VerificationStatus_new" USING "status"::text::"VerificationStatus_new";
    ALTER TABLE "agent" ALTER COLUMN "verificationStatus" TYPE "VerificationStatus_new" USING "verificationStatus"::text::"VerificationStatus_new";

    DROP TYPE "VerificationStatus";
    ALTER TYPE "VerificationStatus_new" RENAME TO "VerificationStatus";

    ALTER TABLE "kyc_verification" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"VerificationStatus";
    ALTER TABLE "kyb_verification" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"VerificationStatus";
    ALTER TABLE "agent" ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING'::"VerificationStatus";
END $$;
