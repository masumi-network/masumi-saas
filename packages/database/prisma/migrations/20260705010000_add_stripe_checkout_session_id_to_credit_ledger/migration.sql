ALTER TABLE "credit_ledger_entry"
ADD COLUMN "stripeCheckoutSessionId" TEXT;

CREATE UNIQUE INDEX "credit_ledger_entry_stripeCheckoutSessionId_key"
ON "credit_ledger_entry"("stripeCheckoutSessionId");
