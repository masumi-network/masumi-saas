import { createRoute } from "@hono/zod-openapi";
import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  getOwnedInboxAgentForUser,
  resolveInboxSmartContractAddress,
  saveInboxAgentReference,
} from "@/lib/inbox-agents/server";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";
import {
  errBody,
  inboxAgentMutationSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["platform"] as const };

const paramsSchema = z.object({
  inboxAgentId: inboxAgentIdRouteParamSchema.openapi({
    param: { name: "inboxAgentId", in: "path" },
    description: "Inbox agent request ID (CUID)",
    example: "cm_inbox_1",
  }),
});

const app = createApiApp("/api/v1/inbox-agents/{inboxAgentId}/deregister");

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Inbox agents"],
    summary: "Deregister inbox agent",
    description:
      "Requests deregistration for a confirmed inbox agent after SaaS verifies ownership and resolves the matching payment source smart contract. The slug remains unavailable until the registry confirms deregistration.",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Deregistration requested",
        content: {
          "application/json": { schema: inboxAgentMutationSuccessSchema },
        },
      },
      503: {
        description: "Payment service unavailable",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    try {
      const authContext = await getAuthenticatedOrThrow(c.req.raw);
      const request = new NextRequest(c.req.raw);
      const network = getEffectivePaymentNetwork(request);
      requireNetworkedOidcApiScope(authContext, {
        resource: "inbox-agents",
        action: "write",
        network,
      });

      const { inboxAgentId } = c.req.valid("param");

      const ownedInboxAgent = await getOwnedInboxAgentForUser({
        userId: authContext.user.id,
        network,
        inboxAgentId,
      });
      if (!ownedInboxAgent) {
        throw new ApiError(404, "Inbox agent not found");
      }

      const inboxAgent = ownedInboxAgent.entry;

      if (inboxAgent.state !== "RegistrationConfirmed") {
        throw new ApiError(
          400,
          "Inbox agent can only be deregistered when registration is confirmed",
        );
      }

      if (!inboxAgent.agentIdentifier) {
        throw new ApiError(
          400,
          "Inbox agent is missing its on-chain identifier",
        );
      }

      const client = createInboxAdminPaymentNodeClient();
      const smartContractAddress =
        ownedInboxAgent.smartContractAddress ??
        (await resolveInboxSmartContractAddress(
          client,
          network,
          inboxAgent.SmartContractWallet.walletVkey,
        ));
      if (!smartContractAddress) {
        throw new ApiError(
          400,
          "Could not resolve the payment source for this inbox agent registration",
        );
      }

      const deregistered = await client.deregisterInboxAgent({
        network,
        agentIdentifier: inboxAgent.agentIdentifier,
        smartContractAddress,
      });

      await saveInboxAgentReference({
        userId: authContext.user.id,
        network,
        entry: deregistered,
        executingWallet: ownedInboxAgent.executingWallet,
        smartContractAddress,
      });

      return c.json(
        {
          success: true as const,
          data: deregistered as unknown as z.infer<
            typeof inboxAgentMutationSuccessSchema
          >["data"],
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      const authResponse = handleAuthError(error);
      if (authResponse) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return authResponse as any;
      }
      console.error("Failed to deregister inbox agent:", error);
      throw new ApiError(500, "Failed to deregister inbox agent");
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
