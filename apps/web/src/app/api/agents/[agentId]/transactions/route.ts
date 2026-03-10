import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount, toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";

function mapItem(
  item: PaymentOrPurchaseItem,
  type: "payment" | "purchase",
  network: string,
): {
  id: string;
  type: "payment" | "purchase";
  txHash: string | null;
  amount: string;
  network: string;
  status: string;
  unlockTime: string | null;
  createdAt: string;
} {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      select: { agentIdentifier: true, networkIdentifier: true },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 },
      );
    }

    if (!agent.agentIdentifier) {
      return NextResponse.json({
        success: true,
        data: { transactions: [] },
      });
    }

    const client = await getPaymentNodeClientForUser(user.id);
    if (!client) {
      return NextResponse.json({
        success: true,
        data: { transactions: [] },
      });
    }

    const smartContractAddress =
      await getSmartContractAddressForConfiguredSource(client, user.id);
    if (!smartContractAddress) {
      return NextResponse.json({
        success: true,
        data: { transactions: [] },
      });
    }

    const network = toNetwork(agent.networkIdentifier);

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
      (p) => p.agentIdentifier === agentIdVal,
    );
    const purchases = (purchasesRes.Purchases ?? []).filter(
      (p) => p.agentIdentifier === agentIdVal,
    );

    const transactions = [
      ...payments.map((p) => mapItem(p, "payment", network)),
      ...purchases.map((p) => mapItem(p, "purchase", network)),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({
      success: true,
      data: { transactions },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agent transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load transactions" },
      { status: 500 },
    );
  }
}
