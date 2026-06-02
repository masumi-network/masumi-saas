import { createRoute } from "@hono/zod-openapi";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  deleteInboxAgentReference,
  getOwnedInboxAgentForUser,
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
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["platform"] as const };

const paramsSchema = z.object({
  inboxAgentId: inboxAgentIdRouteParamSchema.openapi({
    param: { name: "inboxAgentId", in: "path" },
    description: "Inbox agent request ID (CUID)",
    example: "cm_inbox_1",
  }),
});

const app = createApiApp("/api/v1/inbox-agents/{inboxAgentId}");

app.openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: ["Inbox agents"],
    summary: "Delete inbox agent",
    description:
      "Deletes an inbox-agent registration after SaaS verifies it belongs to the caller and is in a user-safe terminal state.",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Deleted",
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
      const request = c.req.raw;
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
      if (
        inboxAgent.state !== "RegistrationFailed" &&
        inboxAgent.state !== "DeregistrationConfirmed"
      ) {
        throw new ApiError(
          400,
          "Inbox agent can only be deleted after registration fails or deregistration is confirmed",
        );
      }

      const client = createInboxAdminPaymentNodeClient();
      const deleted = await client.deleteRegistryInboxEntry(inboxAgent.id);
      await deleteInboxAgentReference(ownedInboxAgent.reference.id);

      return c.json(
        {
          success: true as const,
          data: deleted as unknown as z.infer<
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
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to delete inbox agent:", error);
      throw new ApiError(500, "Failed to delete inbox agent");
    }
  },
);

export const { DELETE } = nextHandlers(app);
export default app;
