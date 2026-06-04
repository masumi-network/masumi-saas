-- MAS-418: scale legacy 1:1 ledger balances to atomic units (800 = one payment write).
UPDATE "user"
SET "creditsRemaining" = "creditsRemaining" * 800
WHERE "creditsRemaining" <> 0;

UPDATE "credit_ledger_entry"
SET
  "delta" = "delta" * 800,
  "balanceAfter" = "balanceAfter" * 800
WHERE "delta" <> 0 OR "balanceAfter" <> 0;
