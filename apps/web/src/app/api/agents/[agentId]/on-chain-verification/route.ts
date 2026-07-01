import { createRoute } from "@hono/zod-openapi";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { getAgentOnChainVerificationStatus } from "@/lib/registry/agent-on-chain-verification-status";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/on-chain-verification");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

const agentOnChainVerificationStatusSchema = z.object({
  configured: z.boolean(),
  registered: z.boolean(),
  hasAnchors: z.boolean(),
  verified: z.boolean(),
  credentialId: z.string().nullable(),
  expiresAt: z.string().nullable(),
  schemaSaid: z.string().nullable(),
  holderAid: z.string().nullable(),
  credentialSaid: z.string().nullable(),
  issuerAid: z.string().nullable(),
  resolutionSource: z.enum(["on-chain", "database"]).nullable(),
  registryAgentIdentifier: z.string().nullable(),
  queriedAgentIdentifier: z.string().nullable(),
});

const onChainVerificationSuccessSchema = z.object({
  success: z.literal(true),
  data: agentOnChainVerificationStatusSchema,
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Get on-chain verification status",
    description:
      "Returns registry NFT verification anchor status for this agent (KERI/ACDC metadata on-chain).",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "On-chain verification status",
        content: {
          "application/json": { schema: onChainVerificationSuccessSchema },
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
        action: "read",
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      const data = await getAgentOnChainVerificationStatus({
        agentIdentifier: agent.agentIdentifier,
        networkIdentifier: agent.networkIdentifier,
      });

      return c.json({ success: true as const, data }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("[Agents] Failed to load on-chain verification status:", {
        agentId,
        error,
      });
      throw new ApiError(500, "Failed to load on-chain verification status");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
