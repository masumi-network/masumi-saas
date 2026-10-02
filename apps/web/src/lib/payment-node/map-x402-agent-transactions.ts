import { formatUnitAmount, x402DisplayUnit } from "@/lib/payment-node/format";
import type { X402AgentPaymentActivityOutput } from "@/lib/payment-node/schemas";

export type MappedAgentTransaction = {
  id: string;
  type: "payment" | "purchase";
  txHash: string | null;
  amount: string;
  network: string;
  status: string;
  unlockTime: string | null;
  createdAt: string;
};

export function mapX402AgentPaymentActivityToTransactions(
  activity: X402AgentPaymentActivityOutput,
): MappedAgentTransaction[] {
  return activity.Attempts.map((attempt) => {
    const unit = x402DisplayUnit(attempt.caip2Network, attempt.asset);
    // Agent-scoped x402 activity is seller income (verified hires to payTo).
    const type: "payment" | "purchase" =
      attempt.direction === "OutboundPayment" ? "payment" : "purchase";

    return {
      id: attempt.id,
      type,
      txHash: attempt.txHash,
      amount: formatUnitAmount(unit, attempt.amount),
      network: attempt.caip2Network,
      status: attempt.status,
      unlockTime: null,
      createdAt: attempt.createdAt.toISOString(),
    };
  }).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
