-- Track the payment-node network binding for custody wallets (PR #694 alignment).
ALTER TABLE "x402_evm_wallet" ADD COLUMN "paymentNodeNetworkId" TEXT;
ALTER TABLE "x402_evm_wallet" ADD COLUMN "caip2Network" TEXT;

CREATE INDEX "x402_evm_wallet_paymentNodeNetworkId_idx" ON "x402_evm_wallet"("paymentNodeNetworkId");
CREATE INDEX "x402_evm_wallet_caip2Network_idx" ON "x402_evm_wallet"("caip2Network");
