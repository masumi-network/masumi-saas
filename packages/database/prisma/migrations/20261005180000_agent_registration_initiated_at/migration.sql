-- AlterTable
ALTER TABLE "agent" ADD COLUMN "registrationInitiatedAt" TIMESTAMP(3);

-- Backfill from activity events when available
UPDATE "agent" AS a
SET "registrationInitiatedAt" = sub.min_created
FROM (
  SELECT "agentId", MIN("createdAt") AS min_created
  FROM "agent_activity_event"
  WHERE "type" = 'RegistrationInitiated' AND "agentId" IS NOT NULL
  GROUP BY "agentId"
) AS sub
WHERE a.id = sub."agentId" AND a."registrationInitiatedAt" IS NULL;

-- Fallback: agents already in initiated (or past) without an event row
UPDATE "agent"
SET "registrationInitiatedAt" = "updatedAt"
WHERE "registrationInitiatedAt" IS NULL
  AND "registrationState" IN (
    'RegistrationInitiated',
    'RegistrationConfirmed',
    'RegistrationFailed',
    'UpdateRequested',
    'UpdateInitiated',
    'UpdateConfirmed',
    'UpdateFailed',
    'DeregistrationRequested',
    'DeregistrationInitiated',
    'DeregistrationConfirmed',
    'DeregistrationFailed'
  );
