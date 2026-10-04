-- Store credits in half-unit integers (2 units = 1 display credit) so 0.5 credit debits are exact.
UPDATE "user"
SET "creditsRemaining" = "creditsRemaining" * 2;

UPDATE "credit_ledger_entry"
SET
  "delta" = "delta" * 2,
  "balanceAfter" = "balanceAfter" * 2;
