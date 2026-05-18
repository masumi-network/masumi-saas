import { createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { deregisterAgentForUser } from "@/lib/deregister-agent";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  agentDeletedSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/deregister");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

function networkFromCookie(c: Context): PaymentNodeNetwork {
  const value = getCookie(c, "payment_network");
  return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
}

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Agents"],
    summary: "Deregister agent on-chain",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Deregistered",
        content: {
          "application/json": { schema: agentDeletedSuccessSchema },
        },
      },
      503: {
        description: "Payment service unavailable",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              error: z.string(),
            }),
          },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw);
    const { user } = authContext;
    const { agentId } = c.req.valid("param");

    try {
      const networkFallback = networkFromCookie(c);
      const agent = await getWalletOwnedAgentForUser({
        userId: user.id,
        agentId,
      });
      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }
      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "write",
        network:
          agent.networkIdentifier === "Mainnet" ? "Mainnet" : networkFallback,
      });

      const result = await deregisterAgentForUser(agentId, user.id, {
        networkFallback,
      });
      if (!result.success) {
        const status =
          result.error === "Agent not found"
            ? 404
            : result.error === "Agent is not registered on the network"
              ? 400
              : 400;
        throw new ApiError(status, result.error);
      }
      return c.json({ success: true as const }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      console.error("Failed to deregister agent:", error);
      throw new ApiError(500, "Failed to deregister agent");
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
