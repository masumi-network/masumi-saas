-- Add KYC-specific status values back to VerificationStatus enum
-- KYC uses: PENDING, APPROVED, REJECTED, REVIEW
-- Agent verification uses: PENDING, VERIFIED, REVOKED, EXPIRED
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
