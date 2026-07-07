-- One active Purchasing and one active Selling wallet per SaaS tenant (personal user or org).

-- Keep the newest wallet per tenant/type; retire older duplicates.
WITH ranked_personal AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "type"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "x402_evm_wallet"
  WHERE "deletedAt" IS NULL
    AND "organizationId" IS NULL
)
UPDATE "x402_evm_wallet" AS w
SET "deletedAt" = NOW()
FROM ranked_personal AS r
WHERE w.id = r.id
  AND r.rn > 1;

WITH ranked_org AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "type"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "x402_evm_wallet"
  WHERE "deletedAt" IS NULL
    AND "organizationId" IS NOT NULL
)
UPDATE "x402_evm_wallet" AS w
SET "deletedAt" = NOW()
FROM ranked_org AS r
WHERE w.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "x402_evm_wallet_user_id_type_personal_key"
ON "x402_evm_wallet" ("userId", "type")
WHERE "deletedAt" IS NULL
  AND "organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "x402_evm_wallet_organization_id_type_key"
ON "x402_evm_wallet" ("organizationId", "type")
WHERE "deletedAt" IS NULL
  AND "organizationId" IS NOT NULL;
