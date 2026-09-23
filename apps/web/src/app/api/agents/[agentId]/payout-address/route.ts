import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { loadSupportedPaymentSourcesForAgent } from "@masumi/payment-source-x402/supported-payment-sources";

import { updateAgentPayoutAddress } from "@/lib/agents/update-agent-payout-address";
import { shapeAgentForApi } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { updateAgentPayoutAddressBodySchema } from "@/lib/schemas/agent";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  agentDetailSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/payout-address");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

app.openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: ["Agents"],
    summary: "Update agent payout address",
    description:
      "Sets the Cardano collection address where completed payments are sent for this agent.",
    security,
    request: {
      params: paramsSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: updateAgentPayoutAddressBodySchema.openapi({
              example: {
                payoutAddress:
                  "addr_test1qqexamplepayoutaddressqqexamplepayoutqq",
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
    const { payoutAddress } = c.req.valid("json");

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

      const result = await updateAgentPayoutAddress({
        userId: authContext.user.id,
        agentId,
        payoutAddress,
      });

      if (!result.success) {
        throw new ApiError(400, result.error);
      }

      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: authContext.user.id },
        include: { agentReference: true },
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
      console.error("Failed to update agent payout address:", error);
      throw new ApiError(500, "Failed to update payout address");
    }
  },
);

export const { PATCH } = nextHandlers(app);
export default app;
