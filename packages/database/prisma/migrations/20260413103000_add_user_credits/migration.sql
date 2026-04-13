ALTER TABLE "user"
ADD COLUMN "creditsRemaining" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "credit_ledger_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_ledger_entry_userId_reason_reference_key"
ON "credit_ledger_entry"("userId", "reason", "reference");

CREATE INDEX "credit_ledger_entry_userId_createdAt_idx"
ON "credit_ledger_entry"("userId", "createdAt");

ALTER TABLE "credit_ledger_entry"
ADD CONSTRAINT "credit_ledger_entry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
