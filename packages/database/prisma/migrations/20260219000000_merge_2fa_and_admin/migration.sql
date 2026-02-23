-- CreateTable (2FA feature)
CREATE TABLE IF NOT EXISTS "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "twoFactor_userId_key" ON "twoFactor"("userId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'twoFactor_userId_fkey'
    ) THEN
        ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable (2FA user field)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable (Admin fields - may already exist from earlier migration)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);

-- AlterTable (Admin session impersonation)
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
