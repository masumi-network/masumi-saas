import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { backfillOnChainVerificationsForAgent } from "@/lib/registry/write-on-chain-verifications";
import { credentialReconcileQuerySchema } from "@/lib/schemas";
import {
  credentialReconcileSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { finalizePendingVeridianCredential } from "@/lib/veridian/finalize-pending-veridian-credential";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credentials/reconcile");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Credentials"],
    summary: "Reconcile pending credentials",
    description:
      "Checks pending credentials for an owned agent and marks the first matching issued credential as resolved.",
    security,
    request: {
      query: credentialReconcileQuerySchema,
    },
    responses: {
      200: {
        description: "Credential reconciliation result",
        content: {
          "application/json": { schema: credentialReconcileSuccessSchema },
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
    const { user } = authContext;

    const { agentId } = c.req.valid("query");

    try {
      // Verify the agent belongs to this user
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: user.id },
        select: { id: true, agentIdentifier: true, networkIdentifier: true },
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }
      requireNetworkedOidcApiScope(authContext, {
        resource: "credentials",
        action: "write",
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      const pendingCredentials = await prisma.veridianCredential.findMany({
        where: { agentId, userId: user.id, status: "PENDING" },
      });

      if (pendingCredentials.length === 0) {
        await backfillOnChainVerificationsForAgent({
          agentId,
          userId: user.id,
        });
        return c.json(
          { success: true as const, data: { resolved: false } },
          200,
        );
      }

      let resolved = false;

      for (const pending of pendingCredentials) {
        try {
          const result = await finalizePendingVeridianCredential({
            pendingCredentialId: pending.id,
            userId: user.id,
          });

          if (result.outcome === "issued" && result.newlyIssued) {
            resolved = true;
            break;
          }
        } catch (error) {
          console.error(`Failed to reconcile credential ${pending.id}:`, error);
        }
      }

      return c.json({ success: true as const, data: { resolved } }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to reconcile credentials:", error);
      throw new ApiError(
        500,
        error instanceof Error
          ? `Failed to reconcile credentials: ${error.message}`
          : "Failed to reconcile credentials",
      );
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
