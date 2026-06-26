-- x402 budgets and payment attempts now reference Better Auth apikey (mas_*), not org-scoped api_key.

DELETE FROM "x402_wallet_budget";
UPDATE "x402_payment_attempt" SET "orgApiKeyId" = NULL WHERE "orgApiKeyId" IS NOT NULL;

ALTER TABLE "x402_wallet_budget" DROP CONSTRAINT "x402_wallet_budget_orgApiKeyId_fkey";
DROP INDEX "x402_wallet_budget_orgApiKeyId_evmWalletId_caip2Network_asset_key";
DROP INDEX "x402_wallet_budget_orgApiKeyId_enabled_idx";

ALTER TABLE "x402_wallet_budget" RENAME COLUMN "orgApiKeyId" TO "apiKeyId";

ALTER TABLE "x402_wallet_budget"
  ADD CONSTRAINT "x402_wallet_budget_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "apikey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "x402_wallet_budget_apiKeyId_evmWalletId_caip2Network_asset_key"
  ON "x402_wallet_budget"("apiKeyId", "evmWalletId", "caip2Network", "asset");
CREATE INDEX "x402_wallet_budget_apiKeyId_enabled_idx"
  ON "x402_wallet_budget"("apiKeyId", "enabled");

ALTER TABLE "x402_payment_attempt" DROP CONSTRAINT "x402_payment_attempt_orgApiKeyId_fkey";
DROP INDEX "x402_payment_attempt_orgApiKeyId_createdAt_idx";

ALTER TABLE "x402_payment_attempt" RENAME COLUMN "orgApiKeyId" TO "apiKeyId";

ALTER TABLE "x402_payment_attempt"
  ADD CONSTRAINT "x402_payment_attempt_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "apikey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "x402_payment_attempt_apiKeyId_createdAt_idx"
  ON "x402_payment_attempt"("apiKeyId", "createdAt");

DROP TABLE "api_key";
