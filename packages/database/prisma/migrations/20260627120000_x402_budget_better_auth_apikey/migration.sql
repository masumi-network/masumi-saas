-- x402 budgets and payment attempts now reference Better Auth apikey (mas_*), not org-scoped api_key.

-- Preserve org-scoped API key rows as disabled Better Auth keys (hashes only; users must rotate).
INSERT INTO "apikey" (
  "id",
  "name",
  "prefix",
  "start",
  "key",
  "userId",
  "enabled",
  "createdAt",
  "updatedAt",
  "metadata"
)
SELECT
  k."id",
  k."name",
  k."keyPrefix",
  LEFT(k."keyPrefix", 12),
  k."keyHash",
  COALESCE(
    k."createdById",
    (
      SELECT m."userId"
      FROM "member" AS m
      WHERE m."organizationId" = k."organizationId"
      ORDER BY
        CASE m."role"
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        m."createdAt" ASC
      LIMIT 1
    )
  ),
  false,
  k."createdAt",
  k."updatedAt",
  jsonb_build_object(
    'migratedFromOrgApiKey', true,
    'organizationId', k."organizationId",
    'requiresKeyRotation', true
  )::text
FROM "api_key" AS k
WHERE COALESCE(
    k."createdById",
    (
      SELECT m."userId"
      FROM "member" AS m
      WHERE m."organizationId" = k."organizationId"
      ORDER BY
        CASE m."role"
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        m."createdAt" ASC
      LIMIT 1
    )
  ) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "apikey" AS a WHERE a."id" = k."id");

-- Drop budgets and attempt links that still reference org keys we could not migrate.
DELETE FROM "x402_wallet_budget" AS b
WHERE NOT EXISTS (
  SELECT 1 FROM "apikey" AS a WHERE a."id" = b."orgApiKeyId"
);

UPDATE "x402_payment_attempt" AS p
SET "orgApiKeyId" = NULL
WHERE p."orgApiKeyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "apikey" AS a WHERE a."id" = p."orgApiKeyId"
  );

ALTER TABLE "x402_wallet_budget" DROP CONSTRAINT IF EXISTS "x402_wallet_budget_orgApiKeyId_fkey";
DROP INDEX IF EXISTS "x402_wallet_budget_orgApiKeyId_evmWalletId_caip2Network_ass_key";
DROP INDEX IF EXISTS "x402_wallet_budget_orgApiKeyId_evmWalletId_caip2Network_asset_key";
DROP INDEX IF EXISTS "x402_wallet_budget_orgApiKeyId_enabled_idx";

ALTER TABLE "x402_wallet_budget" RENAME COLUMN "orgApiKeyId" TO "apiKeyId";

ALTER TABLE "x402_wallet_budget"
  ADD CONSTRAINT "x402_wallet_budget_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "apikey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "x402_wallet_budget_apiKeyId_evmWalletId_caip2Network_asset_key"
  ON "x402_wallet_budget"("apiKeyId", "evmWalletId", "caip2Network", "asset");
CREATE INDEX "x402_wallet_budget_apiKeyId_enabled_idx"
  ON "x402_wallet_budget"("apiKeyId", "enabled");

ALTER TABLE "x402_payment_attempt" DROP CONSTRAINT IF EXISTS "x402_payment_attempt_orgApiKeyId_fkey";
DROP INDEX IF EXISTS "x402_payment_attempt_orgApiKeyId_createdAt_idx";

ALTER TABLE "x402_payment_attempt" RENAME COLUMN "orgApiKeyId" TO "apiKeyId";

ALTER TABLE "x402_payment_attempt"
  ADD CONSTRAINT "x402_payment_attempt_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "apikey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "x402_payment_attempt_apiKeyId_createdAt_idx"
  ON "x402_payment_attempt"("apiKeyId", "createdAt");

DROP TABLE "api_key";
