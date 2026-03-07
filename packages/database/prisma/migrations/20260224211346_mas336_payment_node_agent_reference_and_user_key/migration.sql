-- AlterTable
ALTER TABLE "agent_reference" ADD COLUMN     "buyingWalletVkey" TEXT,
ADD COLUMN     "sellingWalletVkey" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "paymentNodeApiKeyEncrypted" TEXT;
