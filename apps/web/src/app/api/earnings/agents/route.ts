import { createRoute } from "@hono/zod-openapi";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { AGENT_STATES_WITH_EARNINGS } from "@/lib/earnings/agent-income";
import { listUserOwnedAgentsForEarnings } from "@/lib/earnings/owned-agent";
import { parseNetwork } from "@/lib/schemas";
import {
  earningsAgentsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const earningsAgentsQuerySchema = z.object({
  network: z.enum(["Mainnet", "Preprod"]).optional().openapi({
    description: "Target payment network. Defaults to `Preprod` when omitted.",
    example: "Preprod",
  }),
});

export type EarningsAgentsApiResponse =
  | {
      success: true;
      data: Array<{
        id: string;
        name: string;
        icon: string | null;
        agentIdentifier: string;
        registrationState: string;
        network: "Mainnet" | "Preprod";
      }>;
    }
  | { success: false; error: string };

const app = createApiApp("/api/earnings/agents");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Earnings"],
    summary: "List agents eligible for earnings analytics",
    description:
      "Returns owned agents that have a payment identifier and a registration state eligible for earnings reporting.",
    security,
    request: {
      query: earningsAgentsQuerySchema,
    },
    responses: {
      200: {
        description: "Agents eligible for earnings reporting",
        content: {
          "application/json": { schema: earningsAgentsSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    const network = parseNetwork(
      new URL(c.req.url).searchParams.get("network"),
    );
    requireNetworkedOidcApiScope(authContext, {
      resource: "earnings",
      action: "read",
      network,
    });

    try {
      const agents = await listUserOwnedAgentsForEarnings({
        userId: authContext.user.id,
        network,
      });

      const filteredAgents = [...agents]
        .filter(
          (agent) =>
            Boolean(agent.agentIdentifier) &&
            AGENT_STATES_WITH_EARNINGS.has(agent.registrationState),
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          icon: agent.icon,
          agentIdentifier: agent.agentIdentifier!,
          registrationState: agent.registrationState,
          network,
        }));

      return c.json(
        {
          success: true as const,
          data: filteredAgents,
        } satisfies EarningsAgentsApiResponse,
        200,
      );
    } catch (error) {
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to list earnings agents:", error);
      throw new ApiError(500, "Failed to load eligible agents");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
