-- Index the evmWalletId foreign key on x402_payment_attempt. Without it, deleting an
-- X402EvmWallet (onDelete: SetNull) sequentially scans this high-volume history table
-- while holding locks, and lookups of attempts by wallet full-scan.
CREATE INDEX "x402_payment_attempt_evmWalletId_createdAt_idx"
  ON "x402_payment_attempt"("evmWalletId", "createdAt");
