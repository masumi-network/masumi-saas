-- AlterTable: Replace price (string) with pricing (JSON) for dollar-based array structure
ALTER TABLE "agent" DROP COLUMN IF EXISTS "price";
ALTER TABLE "agent" ADD COLUMN "pricing" JSONB;
