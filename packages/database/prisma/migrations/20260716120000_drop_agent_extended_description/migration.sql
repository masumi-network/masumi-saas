-- Preserve long-form copy on agents that only had extendedDescription populated.
UPDATE "agent"
SET "description" = LEFT("extendedDescription", 250)
WHERE "extendedDescription" IS NOT NULL
  AND TRIM("extendedDescription") <> ''
  AND ("description" IS NULL OR TRIM("description") = '');

ALTER TABLE "agent" DROP COLUMN "extendedDescription";
