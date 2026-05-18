import { createRoute } from "@hono/zod-openapi";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  type AgentEarningsAnalytics,
  buildAgentEarningsAnalytics,
  buildEmptyAgentEarningsAnalytics,
  fetchNormalizedAgentPaymentIncome,
  hasAgentEarningsData,
  resolveAgentAnalyticsPeriod,
} from "@/lib/earnings/agent-income";
import { getUserOwnedAgentForEarnings } from "@/lib/earnings/owned-agent";
import { toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { agentAnalyticsQuerySchema } from "@/lib/schemas";
import {
  agentAnalyticsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export type AgentAnalyticsApiResponse =
  | {
      success: true;
      data: AgentEarningsAnalytics & {
        agent: {
          id: string;
          name: string;
          icon: string | null;
          agentIdentifier: string | null;
          network: "Mainnet" | "Preprod";
        };
      };
    }
  | { success: false; error: string };

const app = createApiApp("/api/earnings/agent");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Earnings"],
    summary: "Get per-agent earnings analytics",
    description:
      "Returns earnings analytics, time-bucketed series, and display-unit totals for one owned agent on the selected network.",
    security,
    request: {
      query: agentAnalyticsQuerySchema,
    },
    responses: {
      200: {
        description: "Per-agent earnings analytics",
        content: {
          "application/json": { schema: agentAnalyticsSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    const { agentId, network, range, startDate, endDate, timeZone } =
      c.req.valid("query");

    requireNetworkedOidcApiScope(authContext, {
      resource: "earnings",
      action: "read",
      network,
    });

    try {
      const agent = await getUserOwnedAgentForEarnings({
        userId: authContext.user.id,
        agentId,
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      const agentNetwork = toNetwork(
        agent.agentReference?.networkIdentifier ?? agent.networkIdentifier,
      );

      if (agentNetwork !== network) {
        throw new ApiError(404, "Agent not found");
      }

      const resolvedPeriod = resolveAgentAnalyticsPeriod({
        range,
        startDate,
        endDate,
        timeZone,
      });

      const agentMeta = {
        id: agent.id,
        name: agent.name,
        icon: agent.icon,
        agentIdentifier: agent.agentIdentifier,
        network,
      } as const;

      if (!hasAgentEarningsData(agent)) {
        return c.json(
          {
            success: true as const,
            data: {
              agent: agentMeta,
              ...buildEmptyAgentEarningsAnalytics({
                network,
                range,
                granularity: resolvedPeriod.granularity,
                timeZone,
                resolvedStartDate: resolvedPeriod.startDate,
                resolvedEndDate: resolvedPeriod.endDate,
              }),
            },
          } satisfies AgentAnalyticsApiResponse,
          200,
        );
      }

      const client = await getPaymentNodeClientForUser(authContext.user.id);
      if (!client) {
        return c.json(
          {
            success: true as const,
            data: {
              agent: agentMeta,
              ...buildEmptyAgentEarningsAnalytics({
                network,
                range,
                granularity: resolvedPeriod.granularity,
                timeZone,
                resolvedStartDate: resolvedPeriod.startDate,
                resolvedEndDate: resolvedPeriod.endDate,
              }),
            },
          } satisfies AgentAnalyticsApiResponse,
          200,
        );
      }

      const income = await fetchNormalizedAgentPaymentIncome({
        client,
        network,
        agentIdentifier: agent.agentIdentifier!,
        startDate: resolvedPeriod.startDate,
        endDate: resolvedPeriod.endDate,
        timeZone,
      });

      return c.json(
        {
          success: true as const,
          data: {
            agent: agentMeta,
            ...buildAgentEarningsAnalytics({
              income,
              network,
              range,
              granularity: resolvedPeriod.granularity,
              timeZone,
              resolvedStartDate: resolvedPeriod.startDate,
              resolvedEndDate: resolvedPeriod.endDate,
            }),
          },
        } satisfies AgentAnalyticsApiResponse,
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Failed to get agent earnings analytics:", error);
      throw new ApiError(500, "Failed to load earnings");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
