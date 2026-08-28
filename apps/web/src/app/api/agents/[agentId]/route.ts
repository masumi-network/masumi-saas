import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { loadSupportedPaymentSourcesForAgent } from "@masumi/payment-source-x402/supported-payment-sources";

import { deleteAgentForUser } from "@/lib/agents/delete-agent";
import { updateAgentDetails } from "@/lib/agents/update-agent-details";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { shapeAgentForApi } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { updateAgentDetailsBodySchema } from "@/lib/schemas/agent";
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

      const supportedPaymentSources =
        await loadSupportedPaymentSourcesForAgent(agentId);
      const data = shapeAgentForApi(agent, supportedPaymentSources);

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
      const result = await deleteAgentForUser({
        userId: authContext.user.id,
        agentId,
      });
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

app.openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: ["Agents"],
    summary: "Update agent details",
    description:
      "Updates editable registry metadata for a registered V2 agent (name, description, tags, API URL, capability, legal URLs, example outputs, icon). Pricing and payout address are not changed.",
    security,
    request: {
      params: paramsSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: updateAgentDetailsBodySchema.openapi({
              example: {
                name: "Research assistant",
                description: "Helps with literature review",
                apiUrl: "https://agent.example.com/mip",
                tags: "research, nlp",
                icon: "bot",
                termsOfUseUrl: "https://example.com/terms",
                privacyPolicyUrl: "https://example.com/privacy",
                otherUrl: "",
                capabilityName: "Masumi",
                capabilityVersion: "1.0",
                exampleOutputs: [
                  {
                    name: "Sample output",
                    url: "https://example.com/sample.json",
                    mimeType: "application/json",
                  },
                ],
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated agent",
        content: {
          "application/json": { schema: agentDetailSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw);
    const { agentId } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const existingAgent = await prisma.agent.findFirst({
        where: { id: agentId, userId: authContext.user.id },
        select: { networkIdentifier: true },
      });

      if (!existingAgent) {
        throw new ApiError(404, "Agent not found");
      }

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "write",
        network:
          existingAgent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      const result = await updateAgentDetails({
        userId: authContext.user.id,
        agentId,
        body,
      });

      if (!result.success) {
        throw new ApiError(400, result.error);
      }

      const agent = await getWalletOwnedAgentForUser({
        userId: authContext.user.id,
        agentId,
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      const supportedPaymentSources =
        await loadSupportedPaymentSourcesForAgent(agentId);
      const data = shapeAgentForApi(agent, supportedPaymentSources);

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
      console.error("Failed to update agent details:", error);
      throw new ApiError(500, "Failed to update agent details");
    }
  },
);

export const { GET, PATCH, DELETE } = nextHandlers(app);
export default app;
