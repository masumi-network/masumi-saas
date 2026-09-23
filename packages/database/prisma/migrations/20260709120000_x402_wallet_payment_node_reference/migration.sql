-- Move x402 EVM wallet private-key custody to the payment node: SaaS keeps a reference only.
ALTER TABLE "x402_evm_wallet" ADD COLUMN "paymentNodeWalletId" TEXT;

ALTER TABLE "x402_evm_wallet" ALTER COLUMN "encryptedPrivateKey" DROP NOT NULL;

CREATE INDEX "x402_evm_wallet_paymentNodeWalletId_idx" ON "x402_evm_wallet"("paymentNodeWalletId");
