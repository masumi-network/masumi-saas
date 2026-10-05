import { createRoute } from "@hono/zod-openapi";

import { getAgentTransactionsForUser } from "@/lib/agents/get-agent-transactions-for-user";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
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

      const transactions = await getAgentTransactionsForUser({
        userId: authContext.user.id,
        agentId,
      });

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
