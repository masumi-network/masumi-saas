import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

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
import { finalizePendingVeridianCredential } from "@/lib/veridian/finalize-pending-veridian-credential";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
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
        select: {
          id: true,
          agentId: true,
          status: true,
          credentialId: true,
        },
      });

      if (!pendingCredential) {
        throw new ApiError(404, "Credential not found");
      }

      const agent = pendingCredential.agentId
        ? await prisma.agent.findFirst({
            where: {
              id: pendingCredential.agentId,
              userId: authContext.user.id,
            },
            select: { networkIdentifier: true },
          })
        : null;
      requireNetworkedOidcApiScope(authContext, {
        resource: "credentials",
        action: "read",
        network: agent?.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      let result;
      try {
        result = await finalizePendingVeridianCredential({
          pendingCredentialId: id,
          userId: authContext.user.id,
        });
      } catch (finalizeError) {
        if (
          finalizeError instanceof Error &&
          finalizeError.message === "Credential not found"
        ) {
          throw new ApiError(404, "Credential not found");
        }
        throw finalizeError;
      }

      if (result.outcome === "pending") {
        return c.json(
          {
            success: true as const,
            data: { id: result.id, status: "PENDING" as const },
          },
          200,
        );
      }

      return c.json(
        {
          success: true as const,
          data: {
            id: result.id,
            credentialId: result.credentialId,
            status: result.status as "ISSUED",
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
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
