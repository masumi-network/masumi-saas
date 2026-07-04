import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { credentialReconcileQuerySchema } from "@/lib/schemas";
import {
  credentialPendingSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credentials/pending");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Credentials"],
    summary: "Get pending wallet acceptance credential",
    description:
      "Returns the pending Veridian credential row for an owned agent, if any.",
    security,
    request: {
      query: credentialReconcileQuerySchema,
    },
    responses: {
      200: {
        description: "Pending credential id or null",
        content: {
          "application/json": { schema: credentialPendingSuccessSchema },
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
    const { agentId } = c.req.valid("query");

    try {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: authContext.user.id },
        select: { networkIdentifier: true },
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      requireNetworkedOidcApiScope(authContext, {
        resource: "credentials",
        action: "read",
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      const pending = await prisma.veridianCredential.findFirst({
        where: {
          agentId,
          userId: authContext.user.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      return c.json(
        {
          success: true as const,
          data: { pendingCredentialId: pending?.id ?? null },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to load pending credential:", error);
      throw new ApiError(
        500,
        error instanceof Error
          ? `Failed to load pending credential: ${error.message}`
          : "Failed to load pending credential",
      );
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
