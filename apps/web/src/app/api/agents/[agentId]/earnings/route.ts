import { createRoute } from "@hono/zod-openapi";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  fetchNormalizedAgentPaymentIncome,
  hasAgentEarningsData,
} from "@/lib/earnings/agent-income";
import { getUserOwnedAgentForEarnings } from "@/lib/earnings/owned-agent";
import { toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import {
  agentEarningsQuerySchema,
  agentIdRouteParamSchema,
} from "@/lib/schemas/api-query";
import {
  agentEarningsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/earnings");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

function periodToDateRange(period: "1d" | "7d" | "30d" | "all"): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "1d":
      start.setDate(start.getDate() - 1);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "all":
      start.setFullYear(2020, 0, 1);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Agent earnings",
    security,
    request: {
      params: paramsSchema,
      query: agentEarningsQuerySchema,
    },
    responses: {
      200: {
        description: "Earnings",
        content: {
          "application/json": { schema: agentEarningsSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const { agentId } = c.req.valid("param");
    const { period } = c.req.valid("query");

    try {
      const agent = await getUserOwnedAgentForEarnings({
        userId: authContext.user.id,
        agentId,
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }
      const network = toNetwork(
        agent.agentReference?.networkIdentifier ?? agent.networkIdentifier,
      );

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "read",
        network,
      });

      if (!hasAgentEarningsData(agent)) {
        return c.json(
          {
            success: true as const,
            data: {
              totalTransactions: 0,
              totalIncome: { units: [], blockchainFees: 0 },
              totalRefunded: { units: [], blockchainFees: 0 },
              totalPending: { units: [], blockchainFees: 0 },
              periodStart: null,
              periodEnd: null,
            },
          },
          200,
        );
      }

      const client = await getPaymentNodeClientForUser(authContext.user.id);
      if (!client) {
        return c.json(
          {
            success: true as const,
            data: {
              totalTransactions: 0,
              totalIncome: { units: [], blockchainFees: 0 },
              totalRefunded: { units: [], blockchainFees: 0 },
              totalPending: { units: [], blockchainFees: 0 },
              periodStart: null,
              periodEnd: null,
            },
          },
          200,
        );
      }

      const { startDate, endDate } = periodToDateRange(period);

      const income = await fetchNormalizedAgentPaymentIncome({
        client,
        network,
        agentIdentifier: agent.agentIdentifier!,
        startDate,
        endDate,
        timeZone: "Etc/UTC",
      });

      return c.json(
        {
          success: true as const,
          data: {
            totalTransactions: income.totalTransactions,
            totalIncome: income.totalIncome,
            totalRefunded: income.totalRefunded,
            totalPending: income.totalPending,
            periodStart: income.periodStart,
            periodEnd: income.periodEnd,
            dailyIncome: income.dailyIncome,
            monthlyIncome: income.monthlyIncome,
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to get agent earnings:", error);
      throw new ApiError(500, "Failed to load earnings");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
