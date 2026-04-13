-- Remove unused withdrawal feature (no app consumers; /withdraw redirects to earnings).

-- DropTable
DROP TABLE IF EXISTS "withdrawal";

-- DropEnum
DROP TYPE IF EXISTS "WithdrawalStatus";
