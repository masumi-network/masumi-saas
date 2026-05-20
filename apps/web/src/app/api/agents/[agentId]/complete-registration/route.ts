import { createRoute } from "@hono/zod-openapi";

import { completeOnChainRegistration } from "@/lib/agent-registration";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  completeRegistrationPendingSchema,
  completeRegistrationSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/complete-registration");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Agents"],
    summary: "Complete on-chain registration",
    security,
    request: { params: paramsSchema },
    responses: {
      ...stdResponses,
      200: {
        description: "Registration completed on-chain",
        content: {
          "application/json": { schema: completeRegistrationSuccessSchema },
        },
      },
      202: {
        description:
          "Registration still pending (e.g. registry submission or blockchain confirmation); poll again shortly.",
        content: {
          "application/json": { schema: completeRegistrationPendingSchema },
        },
      },
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

      const result = await completeOnChainRegistration(
        agentId,
        authContext.user.id,
      );

      if (result.status === "registered") {
        // Prisma types are looser than the OpenAPI response schema. Cast.
        type RegisteredData = z.infer<
          typeof completeRegistrationSuccessSchema
        >["data"];
        return c.json(
          {
            success: true as const,
            data: result.data as unknown as RegisteredData,
            status: "registered" as const,
          },
          200,
        );
      }
      if (result.status === "pending") {
        return c.json(
          {
            success: true as const,
            status: "pending" as const,
            message: "Wallet not yet funded. Poll again in a few seconds.",
          },
          202,
        );
      }
      throw new ApiError(400, result.error);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to complete agent registration:", error);
      throw new ApiError(
        500,
        error instanceof Error
          ? error.message
          : "Failed to complete registration",
      );
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
