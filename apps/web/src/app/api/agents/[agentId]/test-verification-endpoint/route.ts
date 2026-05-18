import { createRoute } from "@hono/zod-openapi";

import { fetchAgentCredentialChallenge } from "@/lib/agent-verification";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  security,
  stdResponses,
  testVerificationEndpointSuccessSchema,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/test-verification-endpoint");

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
    summary: "Test agent verification URL",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Test result",
        content: {
          "application/json": { schema: testVerificationEndpointSuccessSchema },
        },
      },
      503: verificationUnavailableResponse,
      ...stdResponses,
    },
  }),
  async (c) => {
    if (!isAgentVerificationFlowEnabled()) {
      throw new ApiError(
        503,
        verificationFeatureCopy.agentVerificationUnavailableDescription,
      );
    }

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

      if (agent.registrationState !== "RegistrationConfirmed") {
        throw new ApiError(
          400,
          `Agent must be registered. Current state: ${agent.registrationState}`,
        );
      }

      const challenge = agent.verificationChallenge;
      const secret = agent.verificationSecret;

      if (!challenge || !secret) {
        throw new ApiError(
          400,
          "No verification challenge or secret. Generate one from the dialog first.",
        );
      }

      const result = await fetchAgentCredentialChallenge(
        agent.apiUrl,
        challenge,
        secret,
      );

      if (!result.success) {
        throw new ApiError(400, result.error);
      }

      return c.json(
        {
          success: true as const,
          data: { message: "Endpoint is working correctly." },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Failed to test verification endpoint:", error);
      throw new ApiError(
        500,
        error instanceof Error
          ? error.message
          : "Failed to test verification endpoint",
      );
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
