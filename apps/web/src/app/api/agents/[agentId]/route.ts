import { createRoute } from "@hono/zod-openapi";

import { deleteAgentAction } from "@/lib/actions/agent.action";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  agentDeletedSuccessSchema,
  agentDetailSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}");

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
    summary: "Get agent",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Agent detail",
        content: {
          "application/json": { schema: agentDetailSuccessSchema },
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

      const data = shapeAgentWithMergedMetadata(agent);

      // Prisma `verificationStatus`/dates are looser than the OpenAPI response
      // schema. Cast so Hono accepts the response body shape.
      return c.json(
        {
          success: true as const,
          data: data as unknown as z.infer<
            typeof agentDetailSuccessSchema
          >["data"],
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to get agent:", error);
      throw new ApiError(500, "Failed to get agent");
    }
  },
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: ["Agents"],
    summary: "Delete agent",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Deleted",
        content: {
          "application/json": { schema: agentDeletedSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw);
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
        action: "write",
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });
      const result = await deleteAgentAction(agentId, authContext.user.id);
      if (!result.success) {
        const status = result.error === "Agent not found" ? 404 : 400;
        throw new ApiError(status, result.error);
      }
      return c.json({ success: true as const }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to delete agent:", error);
      throw new ApiError(500, "Failed to delete agent");
    }
  },
);

export const { GET, DELETE } = nextHandlers(app);
export default app;
