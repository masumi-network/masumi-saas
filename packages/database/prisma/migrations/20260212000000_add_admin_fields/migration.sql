-- AlterTable
ALTER TABLE "user" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "banReason" TEXT,
ADD COLUMN "banExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "session" ADD COLUMN "impersonatedBy" TEXT;
