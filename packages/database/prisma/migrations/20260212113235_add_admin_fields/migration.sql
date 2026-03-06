-- AlterTable (idempotent — same columns added in 20260212000000_add_admin_fields)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "banReason" TEXT,
ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
