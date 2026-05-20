import { createRoute } from "@hono/zod-openapi";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { formatRequestedAmount, toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  agentTransactionsSuccessSchema,
  errBody,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/transactions");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

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

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Agent transactions",
    description: "Payment and purchase activity for one agent.",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Transactions",
        content: {
          "application/json": { schema: agentTransactionsSuccessSchema },
        },
      },
      503: {
        description: "Payment node unavailable",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const { agentId } = c.req.valid("param");

    try {
      const agent = await getWalletOwnedAgentForUser({
        userId: authContext.user.id,
        agentId,
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }
      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "read",
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      if (!agent.agentIdentifier) {
        return c.json(
          { success: true as const, data: { transactions: [] } },
          200,
        );
      }

      const client = await getPaymentNodeClientForUser(authContext.user.id);
      if (!client) {
        return c.json(
          { success: true as const, data: { transactions: [] } },
          200,
        );
      }

      const network = toNetwork(agent.networkIdentifier);

      const smartContractAddress =
        await getSmartContractAddressForConfiguredSource(
          client,
          authContext.user.id,
          network,
        );
      if (!smartContractAddress) {
        return c.json(
          { success: true as const, data: { transactions: [] } },
          200,
        );
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

      return c.json({ success: true as const, data: { transactions } }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to get agent transactions:", error);
      throw new ApiError(500, "Failed to load transactions");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
