-- AlterEnum (step 1/2): Add new enum values only.
-- New values must be committed before use, so we do not use them in this migration.
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
