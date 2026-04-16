import { NextRequest } from "next/server";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { formatRequestedAmount, toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";

import contract from "./route.contract";

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
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { agentId } = await params;

    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return contractJsonResponse(contract, "GET", 404, {
        success: false,
        error: "Agent not found",
      });
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    if (!agent.agentIdentifier) {
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: { transactions: [] },
      });
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: { transactions: [] },
      });
    }

    const network = toNetwork(agent.networkIdentifier);

    const smartContractAddress =
      await getSmartContractAddressForConfiguredSource(
        client,
        authContext.user.id,
        network,
      );
    if (!smartContractAddress) {
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: { transactions: [] },
      });
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

    const transactions = [
      ...payments.map((p: PaymentOrPurchaseItem) =>
        mapItem(p, "payment", network),
      ),
      ...purchases.map((p: PaymentOrPurchaseItem) =>
        mapItem(p, "purchase", network),
      ),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: { transactions },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    if (isPaymentNodeConfigError(error)) {
      return contractJsonResponse(contract, "GET", 503, {
        success: false,
        error: error.message,
      });
    }
    console.error("Failed to get agent transactions:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load transactions",
    });
  }
}
