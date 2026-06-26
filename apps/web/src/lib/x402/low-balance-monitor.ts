import { evaluateX402LowBalanceRules } from "@masumi/payment-source-x402";

import { triggerX402WalletLowBalance } from "@/lib/x402/webhook-events";

/**
 * Scheduled cycle for x402 managed-wallet low-balance monitoring. Evaluates every enabled
 * rule across all tenants and fans out X402_WALLET_LOW_BALANCE webhooks for rules that just
 * transitioned into Low.
 */
export async function runX402LowBalanceMonitoringCycle(): Promise<void> {
  const alerts = await evaluateX402LowBalanceRules();
  if (alerts.length === 0) return;

  console.info("[x402] low-balance monitoring raised alerts", {
    count: alerts.length,
  });

  for (const alert of alerts) {
    triggerX402WalletLowBalance(alert.userId, {
      ruleId: alert.ruleId,
      evmWalletId: alert.evmWalletId,
      walletAddress: alert.walletAddress,
      walletType: alert.walletType,
      caip2Network: alert.caip2Network,
      asset: alert.asset,
      thresholdAmount: alert.thresholdAmount,
      currentAmount: alert.currentAmount,
      checkedAt: alert.checkedAt,
    });
  }
}
