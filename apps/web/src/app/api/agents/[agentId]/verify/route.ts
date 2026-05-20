import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  errBodyWithOptionalDetails,
  security,
  stdResponses,
  verificationUnavailableResponse,
  verifyAgentOpenApiBodySchema,
  verifyAgentSuccessSchema,
} from "@/lib/swagger/saas-app-openapi";
import {
  fetchContactCredentials,
  findCredentialBySchema,
  getAgentVerificationSchemaSaid,
  validateCredential,
} from "@/lib/veridian";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/verify");

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
    summary: "Verify agent (credential flow)",
    security,
    request: {
      params: paramsSchema,
      body: {
        required: true,
        content: {
          "application/json": { schema: verifyAgentOpenApiBodySchema },
        },
      },
    },
    responses: {
      ...stdResponses,
      200: {
        description: "Verification step result",
        content: {
          "application/json": { schema: verifyAgentSuccessSchema },
        },
      },
      400: {
        description:
          "Invalid body (e.g. missing `aid`), KYC/agent preconditions, or credential validation failure. May include `details` (string[] or credential metadata object).",
        content: {
          "application/json": { schema: errBodyWithOptionalDetails },
        },
      },
      503: verificationUnavailableResponse,
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
    const { aid, schemaSaid } = c.req.valid("json");

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

      const userWithKyc = await prisma.user.findUnique({
        where: { id: authContext.user.id },
        include: {
          kycVerification: true,
        },
      });

      if (!userWithKyc?.kycVerification) {
        throw new ApiError(
          400,
          "KYC verification not found. Please complete KYC verification first.",
        );
      }

      // KYC status APPROVED means the user's identity is verified
      if (userWithKyc.kycVerification.status !== "APPROVED") {
        throw new ApiError(
          400,
          `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
        );
      }

      // Verify AID ownership by checking if we have a credential record for this agent and AID
      // This ensures the user actually owns the AID (credential was issued with signature verification)
      const existingCredential = await prisma.veridianCredential.findFirst({
        where: {
          agentId: agentId,
          userId: authContext.user.id,
          aid: aid,
          status: "ISSUED",
        },
      });

      if (!existingCredential) {
        throw new ApiError(
          400,
          "No credential found for this agent and AID. Please issue a credential first using the Request Credential dialog.",
        );
      }

      let credentialId: string | null = null;
      try {
        const credentials = await fetchContactCredentials(aid);

        if (credentials.length === 0) {
          throw new ApiError(
            400,
            "No credentials found for this identifier. Please ensure you have credentials issued to this AID.",
          );
        }

        const expectedSchemaSaid =
          schemaSaid || getAgentVerificationSchemaSaid();

        const selectedCredential = findCredentialBySchema(
          credentials,
          expectedSchemaSaid,
        );

        if (!selectedCredential) {
          throw new ApiError(
            400,
            `Required credential with schema SAID '${expectedSchemaSaid}' not found. Please ensure you have the correct credential issued to this identifier.`,
          );
        }

        const validationResult = validateCredential(selectedCredential);

        if (!validationResult.isValid) {
          throw new ApiError(
            400,
            `Credential validation failed: ${validationResult.message}`,
            { details: validationResult.details },
          );
        }

        credentialId = selectedCredential.sad?.d || null;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        rethrowIfAuthOrCreditsError(error);
        console.error("Failed to fetch/validate credentials:", error);
        throw new ApiError(500, "Failed to validate credentials");
      }

      // Update agent verification status to VERIFIED when credential validation succeeds
      // The credential has been validated and is valid, so the agent is verified
      const updatedAgent = await prisma.agent.update({
        where: {
          id: agentId,
        },
        data: {
          verificationStatus: "VERIFIED" as const,
          veridianCredentialId: credentialId,
        },
      });

      await recordAgentActivityEvent(agentId, "AgentVerified");

      // Prisma `verificationStatus`/dates are looser than the OpenAPI response
      // schema. Cast so Hono accepts the response body shape.
      return c.json(
        {
          success: true as const,
          data: updatedAgent as unknown as z.infer<
            typeof verifyAgentSuccessSchema
          >["data"],
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to request agent verification:", error);
      throw new ApiError(500, "Failed to request agent verification");
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
