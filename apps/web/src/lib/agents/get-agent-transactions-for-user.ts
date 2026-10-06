import prisma from "@masumi/database/client";

import {
  filterAgentTransactionsOnOrAfterCutoff,
  resolveAgentActivityTransactionCutoff,
} from "@/lib/agents/agent-activity-transaction-cutoff";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { resolveAgentPaymentRail } from "@/lib/earnings/agent-income";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount, toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { mapX402AgentPaymentActivityToTransactions } from "@/lib/payment-node/map-x402-agent-transactions";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";

export type AgentTransactionRow = {
  id: string;
  type: "payment" | "purchase";
  txHash: string | null;
  amount: string;
  network: string;
  status: string;
  unlockTime: string | null;
  createdAt: string;
};

function mapItem(
  item: PaymentOrPurchaseItem,
  type: "payment" | "purchase",
  network: string,
): AgentTransactionRow {
  const status = item.onChainState ?? item.NextAction?.requestedAction ?? "—";
  return {
    id: item.id,
    type,
    txHash: item.CurrentTransaction?.txHash ?? null,
    amount: formatRequestedAmount(item.RequestedFunds),
    network: item.PaymentSource?.network ?? network,
    status: String(status),
    unlockTime: item.unlockTime ?? null,
    createdAt: item.createdAt,
  };
}

export async function getAgentTransactionsForUser(params: {
  userId: string;
  agentId: string;
}): Promise<AgentTransactionRow[]> {
  const agent = await getWalletOwnedAgentForUser({
    userId: params.userId,
    agentId: params.agentId,
  });

  if (!agent?.agentIdentifier) {
    return [];
  }

  const client = await getPaymentNodeClientForUser(params.userId);
  if (!client) {
    return [];
  }

  const network = toNetwork(
    agent.agentReference?.networkIdentifier ?? agent.networkIdentifier,
  );

  const registrationInitiatedEvents = await prisma.agentActivityEvent.findMany({
    where: { agentId: params.agentId, type: "RegistrationInitiated" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { createdAt: true },
  });
  const transactionCutoff = resolveAgentActivityTransactionCutoff({
    agentCreatedAt: agent.createdAt,
    registrationInitiatedAt: agent.registrationInitiatedAt,
    registrationInitiatedEventsNewestFirst: registrationInitiatedEvents.map(
      (e) => e.createdAt,
    ),
  });

  if (resolveAgentPaymentRail(agent) === "x402") {
    const end = new Date();
    const activity = await client.getX402AgentPaymentActivity({
      network,
      agentIdentifier: agent.agentIdentifier,
      startDate: transactionCutoff.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      take: 50,
    });
    return filterAgentTransactionsOnOrAfterCutoff(
      mapX402AgentPaymentActivityToTransactions(activity),
      transactionCutoff,
    );
  }

  const smartContractAddress = await getSmartContractAddressForConfiguredSource(
    client,
    params.userId,
    network,
  );
  if (!smartContractAddress) {
    return [];
  }

  const [paymentsRes, purchasesRes] = await Promise.all([
    client.listPayments({
      network,
      filterSmartContractAddress: smartContractAddress,
      limit: 50,
    }),
    client.listPurchases({
      network,
      filterSmartContractAddress: smartContractAddress,
      limit: 50,
    }),
  ]);

  const agentIdVal = agent.agentIdentifier;
  const payments = (paymentsRes.Payments ?? []).filter(
    (p: PaymentOrPurchaseItem) => p.agentIdentifier === agentIdVal,
  );
  const purchases = (purchasesRes.Purchases ?? []).filter(
    (p: PaymentOrPurchaseItem) => p.agentIdentifier === agentIdVal,
  );

  const rows = [
    ...payments.map((p: PaymentOrPurchaseItem) =>
      mapItem(p, "payment", network),
    ),
    ...purchases.map((p: PaymentOrPurchaseItem) =>
      mapItem(p, "purchase", network),
    ),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return filterAgentTransactionsOnOrAfterCutoff(rows, transactionCutoff);
}
