-- Allow the same user to own a personal chain and an org-shared chain with the same CAIP-2 id.
-- Budgets/payment attempts reference the network row by id instead of (userId, caip2Id).

ALTER TABLE "x402_wallet_budget" ADD COLUMN "x402NetworkId" TEXT;
ALTER TABLE "x402_payment_attempt" ADD COLUMN "x402NetworkId" TEXT;

-- Personal-tenant rows (no org on the network).
UPDATE "x402_wallet_budget" AS b
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
WHERE b."userId" = n."userId"
  AND b."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NULL
  AND b."x402NetworkId" IS NULL;

-- Org-tenant rows (budget orgApiKey → api_key.organizationId → network).
UPDATE "x402_wallet_budget" AS b
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
INNER JOIN "api_key" AS k ON k."organizationId" = n."organizationId"
WHERE b."orgApiKeyId" = k.id
  AND b."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NOT NULL
  AND b."x402NetworkId" IS NULL;

UPDATE "x402_payment_attempt" AS p
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
WHERE p."userId" = n."userId"
  AND p."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NULL
  AND p."orgApiKeyId" IS NULL
  AND p."agentId" IS NULL
  AND p."x402NetworkId" IS NULL;

UPDATE "x402_payment_attempt" AS p
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
INNER JOIN "api_key" AS k ON k."organizationId" = n."organizationId"
WHERE p."orgApiKeyId" = k.id
  AND p."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NOT NULL
  AND p."x402NetworkId" IS NULL;

UPDATE "x402_payment_attempt" AS p
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
INNER JOIN "agent" AS a ON a."organizationId" = n."organizationId"
WHERE p."agentId" = a.id
  AND p."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NOT NULL
  AND p."x402NetworkId" IS NULL;

UPDATE "x402_payment_attempt" AS p
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
INNER JOIN "agent" AS a ON a."userId" = n."userId"
WHERE p."agentId" = a.id
  AND p."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NULL
  AND a."organizationId" IS NULL
  AND p."x402NetworkId" IS NULL;

-- Legacy rows created before an org network existed: fall back to the user's personal network.
UPDATE "x402_wallet_budget" AS b
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
WHERE b."userId" = n."userId"
  AND b."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NULL
  AND b."x402NetworkId" IS NULL;

UPDATE "x402_payment_attempt" AS p
SET "x402NetworkId" = n.id
FROM "x402_network" AS n
WHERE p."userId" = n."userId"
  AND p."caip2Network" = n."caip2Id"
  AND n."organizationId" IS NULL
  AND p."x402NetworkId" IS NULL;

ALTER TABLE "x402_wallet_budget" DROP CONSTRAINT IF EXISTS "x402_wallet_budget_userId_caip2Network_fkey";
ALTER TABLE "x402_payment_attempt" DROP CONSTRAINT IF EXISTS "x402_payment_attempt_userId_caip2Network_fkey";

DROP INDEX IF EXISTS "x402_network_userId_caip2Id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "x402_network_user_id_caip2_id_personal_key"
ON "x402_network" ("userId", "caip2Id")
WHERE "organizationId" IS NULL;

-- Fix broken index from payment_rail migration (wrong column names).
DROP INDEX IF EXISTS "x402_network_organization_id_caip2_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "x402_network_organization_id_caip2_id_key"
ON "x402_network" ("organizationId", "caip2Id")
WHERE "organizationId" IS NOT NULL;

ALTER TABLE "x402_wallet_budget"
  ADD CONSTRAINT "x402_wallet_budget_x402NetworkId_fkey"
  FOREIGN KEY ("x402NetworkId") REFERENCES "x402_network"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "x402_payment_attempt"
  ADD CONSTRAINT "x402_payment_attempt_x402NetworkId_fkey"
  FOREIGN KEY ("x402NetworkId") REFERENCES "x402_network"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "x402_wallet_budget" ALTER COLUMN "x402NetworkId" SET NOT NULL;
ALTER TABLE "x402_payment_attempt" ALTER COLUMN "x402NetworkId" SET NOT NULL;

CREATE INDEX "x402_wallet_budget_x402NetworkId_idx" ON "x402_wallet_budget"("x402NetworkId");
CREATE INDEX "x402_payment_attempt_x402NetworkId_idx" ON "x402_payment_attempt"("x402NetworkId");
