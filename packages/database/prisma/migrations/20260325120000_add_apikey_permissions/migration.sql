-- Better Auth api-key plugin expects `permissions` on `apikey` (string, optional).
ALTER TABLE "apikey" ADD COLUMN "permissions" TEXT;
