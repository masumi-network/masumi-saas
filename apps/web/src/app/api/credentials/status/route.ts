import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { credentialStatusQuerySchema } from "@/lib/schemas";
import {
  credentialStatusSuccessSchema,
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

const app = createApiApp("/api/credentials/status");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Credentials"],
    summary: "Get credential status",
    description:
      "Polls the current credential state for a pending or issued verification credential owned by the caller.",
    security,
    request: {
      query: credentialStatusQuerySchema,
    },
    responses: {
      200: {
        description: "Credential status",
        content: {
          "application/json": { schema: credentialStatusSuccessSchema },
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

    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    const { id } = c.req.valid("query");

    try {
      const pendingCredential = await prisma.veridianCredential.findFirst({
        where: { id, userId: authContext.user.id },
      });

      if (!pendingCredential) {
        throw new ApiError(404, "Credential not found");
      }

      // Already resolved — return current state immediately
      if (pendingCredential.status !== "PENDING") {
        return c.json(
          {
            success: true as const,
            data: {
              id: pendingCredential.id,
              credentialId: pendingCredential.credentialId,
              status: pendingCredential.status,
            },
          },
          200,
        );
      }

      const { aid, agentId } = pendingCredential;
      const schemaSaid = getAgentVerificationSchemaSaid();

      // Get agent's payment node identifier for filtering
      const agent = agentId
        ? await prisma.agent.findFirst({
            where: { id: agentId },
            select: { agentIdentifier: true, networkIdentifier: true },
          })
        : null;
      requireNetworkedOidcApiScope(authContext, {
        resource: "credentials",
        action: "read",
        network: agent?.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      // Check Veridian for the accepted credential
      const credentials = await fetchContactCredentials(aid);
      const matchingCredentials = credentials.filter((cred) => {
        const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
        if (credSchemaSaid !== schemaSaid) return false;

        if (cred.sad?.a && agent?.agentIdentifier) {
          const credAgentId = cred.sad.a.agentId as string | undefined;
          return credAgentId === agent.agentIdentifier;
        }

        return true;
      });

      if (matchingCredentials.length === 0) {
        return c.json(
          {
            success: true as const,
            data: { id: pendingCredential.id, status: "PENDING" as const },
          },
          200,
        );
      }

      const issuedCredential = matchingCredentials.sort((a, b) => {
        const dateA = new Date((a.sad?.a?.dt as string) || 0).getTime();
        const dateB = new Date((b.sad?.a?.dt as string) || 0).getTime();
        return dateB - dateA;
      })[0];

      if (!issuedCredential?.sad?.d) {
        return c.json(
          {
            success: true as const,
            data: { id: pendingCredential.id, status: "PENDING" as const },
          },
          200,
        );
      }

      const credentialId = issuedCredential.sad.d;

      const updated = await prisma.veridianCredential.update({
        where: { id: pendingCredential.id },
        data: { credentialId, status: "ISSUED" },
      });

      if (agentId) {
        const prior = await prisma.agent.findUnique({
          where: { id: agentId },
          select: { verificationStatus: true },
        });
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            verificationStatus: "VERIFIED",
            veridianCredentialId: credentialId,
          },
        });
        if (prior?.verificationStatus !== "VERIFIED") {
          await recordAgentActivityEvent(agentId, "AgentVerified");
        }
      }

      return c.json(
        {
          success: true as const,
          data: {
            id: updated.id,
            credentialId: updated.credentialId,
            status: updated.status,
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Failed to check credential status:", error);
      throw new ApiError(
        500,
        error instanceof Error
          ? `Failed to check credential status: ${error.message}`
          : "Failed to check credential status",
      );
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
