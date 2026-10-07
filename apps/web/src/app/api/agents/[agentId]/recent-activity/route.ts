import { createRoute } from "@hono/zod-openapi";

import {
  AGENT_RECENT_ACTIVITY_PAGE_SIZE,
  buildAgentRecentActivityFeed,
  paginateAgentRecentActivity,
} from "@/lib/agents/build-agent-recent-activity";
import { getAgentTransactionsForUser } from "@/lib/agents/get-agent-transactions-for-user";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  errBody,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/recent-activity");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
  }),
});

const querySchema = z.object({
  page: z
    .string()
    .optional()
    .openapi({
      param: { name: "page", in: "query" },
      description: "1-based page number",
      example: "1",
    }),
  limit: z
    .string()
    .optional()
    .openapi({
      param: { name: "limit", in: "query" },
      description: "Page size (default 10, max 50)",
      example: "10",
    }),
});

const recentActivitySuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.union([
        z.object({
          kind: z.literal("lifecycle"),
          id: z.string(),
          date: z.string(),
          eventKey: z.string(),
          failed: z.boolean().optional(),
        }),
        z.object({
          kind: z.literal("transaction"),
          id: z.string(),
          date: z.string(),
          txType: z.enum(["payment", "purchase"]),
          amount: z.string(),
          status: z.string(),
          txHash: z.string().nullable(),
        }),
      ]),
    ),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
  }),
});

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isNaN(n) || n < 1 ? 1 : n;
}

function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? String(AGENT_RECENT_ACTIVITY_PAGE_SIZE), 10);
  if (Number.isNaN(n)) return AGENT_RECENT_ACTIVITY_PAGE_SIZE;
  return Math.min(50, Math.max(1, n));
}

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Agent recent activity",
    description:
      "Merged registry lifecycle and payment/purchase activity for one agent, newest first.",
    security,
    request: { params: paramsSchema, query: querySchema },
    responses: {
      200: {
        description: "Recent activity page",
        content: {
          "application/json": { schema: recentActivitySuccessSchema },
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
    const query = c.req.valid("query");
    const page = parsePage(query.page);
    const pageSize = parseLimit(query.limit);

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

      let transactions: Awaited<
        ReturnType<typeof getAgentTransactionsForUser>
      > = [];
      try {
        transactions = await getAgentTransactionsForUser({
          userId: authContext.user.id,
          agentId,
        });
      } catch (txError) {
        if (isPaymentNodeConfigError(txError)) {
          throw new ApiError(503, txError.message);
        }
        console.error(
          "Agent recent activity: payment transactions skipped:",
          txError,
        );
      }

      const feed = await buildAgentRecentActivityFeed({
        agentId,
        registrationState: agent.registrationState,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        registrationInitiatedAt: agent.registrationInitiatedAt,
        transactions,
      });

      const paged = paginateAgentRecentActivity(feed, page, pageSize);

      return c.json(
        {
          success: true as const,
          data: paged,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to get agent recent activity:", error);
      throw new ApiError(500, "Failed to load recent activity");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
