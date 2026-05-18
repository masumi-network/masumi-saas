import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { credentialReconcileQuerySchema } from "@/lib/schemas";
import {
  credentialReconcileSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import {
  fetchContactCredentials,
  getAgentVerificationSchemaSaid,
} from "@/lib/veridian";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
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
        return c.json(
          { success: true as const, data: { resolved: false } },
          200,
        );
      }

      const schemaSaid = getAgentVerificationSchemaSaid();
      let resolved = false;

      for (const pending of pendingCredentials) {
        try {
          const credentials = await fetchContactCredentials(pending.aid);
          const matchingCredentials = credentials.filter((cred) => {
            const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
            if (credSchemaSaid !== schemaSaid) return false;

            if (cred.sad?.a && agent.agentIdentifier) {
              const credAgentId = cred.sad.a.agentId as string | undefined;
              return credAgentId === agent.agentIdentifier;
            }

            return true;
          });

          if (matchingCredentials.length === 0) continue;

          const issuedCredential = matchingCredentials.sort((a, b) => {
            const dateA = new Date((a.sad?.a?.dt as string) || 0).getTime();
            const dateB = new Date((b.sad?.a?.dt as string) || 0).getTime();
            return dateB - dateA;
          })[0];

          if (!issuedCredential?.sad?.d) continue;

          const credentialId = issuedCredential.sad.d;

          await prisma.veridianCredential.update({
            where: { id: pending.id },
            data: { credentialId, status: "ISSUED" },
          });

          await prisma.agent.update({
            where: { id: agentId },
            data: {
              verificationStatus: "VERIFIED",
              veridianCredentialId: credentialId,
            },
          });

          await recordAgentActivityEvent(agentId, "AgentVerified");

          resolved = true;
          // One resolved is enough to flip the agent to VERIFIED
          break;
        } catch (error) {
          // Log but continue checking other pending records
          console.error(`Failed to reconcile credential ${pending.id}:`, error);
        }
      }

      return c.json({ success: true as const, data: { resolved } }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
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
