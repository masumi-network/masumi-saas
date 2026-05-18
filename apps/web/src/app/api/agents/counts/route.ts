import { createRoute } from "@hono/zod-openapi";

import { listWalletOwnedAgentsForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { agentCountsQuerySchema } from "@/lib/schemas/api-query";
import {
  agentCountsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/counts");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Aggregate agent counts",
    description: "Counts by status and network for the current user.",
    security,
    request: {
      query: agentCountsQuerySchema,
    },
    responses: {
      200: {
        description: "Counts",
        content: {
          "application/json": { schema: agentCountsSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    const { network } = c.req.valid("query");
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network,
    });

    const agents = await listWalletOwnedAgentsForUser({
      userId: authContext.user.id,
      network,
    });

    const all = agents.length;
    const registered = agents.filter(
      (agent) => agent.registrationState === "RegistrationConfirmed",
    ).length;
    const deregistered = agents.filter(
      (agent) => agent.registrationState === "DeregistrationConfirmed",
    ).length;
    const pending = agents.filter((agent) =>
      ["RegistrationRequested", "DeregistrationRequested"].includes(
        agent.registrationState,
      ),
    ).length;
    const failed = agents.filter((agent) =>
      ["RegistrationFailed", "DeregistrationFailed"].includes(
        agent.registrationState,
      ),
    ).length;
    const verified = agents.filter(
      (agent) => agent.verificationStatus === "VERIFIED",
    ).length;

    return c.json(
      {
        success: true as const,
        data: {
          all,
          registered,
          deregistered,
          pending,
          failed,
          verified,
        },
      },
      200,
    );
  },
);

export const { GET } = nextHandlers(app);
export default app;
