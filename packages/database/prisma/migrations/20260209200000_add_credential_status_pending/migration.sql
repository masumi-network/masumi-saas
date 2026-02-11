-- Add PENDING to CredentialStatus enum (for credentials created before poll completes)
ALTER TYPE "CredentialStatus" ADD VALUE 'PENDING' BEFORE 'ISSUED';
