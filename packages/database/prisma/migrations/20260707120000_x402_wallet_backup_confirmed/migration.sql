-- AlterTable
ALTER TABLE "x402_evm_wallet" ADD COLUMN "backupConfirmedAt" TIMESTAMP(3);

-- Existing wallets were created before explicit backup confirmation.
UPDATE "x402_evm_wallet"
SET "backupConfirmedAt" = "createdAt"
WHERE "backupConfirmedAt" IS NULL;
