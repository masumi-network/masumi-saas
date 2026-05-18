import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { randomBytes, randomUUID } from "crypto";
import type { Context } from "hono";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  security,
  stdResponses,
  verificationChallengePostBodySchema,
  verificationChallengeSuccessSchema,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/verification-challenge");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

async function handleChallengeRequest(
  c: Context,
  agentId: string,
  regenerate: boolean,
) {
  if (!isAgentVerificationFlowEnabled()) {
    throw new ApiError(
      503,
      verificationFeatureCopy.agentVerificationUnavailableDescription,
    );
  }

  const authContext = await getAuthenticatedOrThrow(c.req.raw);

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

    if (agent.registrationState !== "RegistrationConfirmed") {
      throw new ApiError(
        400,
        `Agent must be registered. Current state: ${agent.registrationState}`,
      );
    }

    let challenge = agent.verificationChallenge;
    let secret = agent.verificationSecret;
    let generatedAt = agent.verificationChallengeGeneratedAt;

    if (regenerate || !challenge || !secret) {
      challenge = randomUUID();
      secret = randomBytes(32).toString("hex");
      const updated = await prisma.agent.update({
        where: { id: agentId },
        data: {
          verificationChallenge: challenge,
          verificationSecret: secret,
          verificationChallengeGeneratedAt: new Date(),
        },
      });
      generatedAt = updated.verificationChallengeGeneratedAt;
    }

    return c.json(
      {
        success: true as const,
        data: {
          challenge,
          secret,
          generatedAt: generatedAt?.toISOString() ?? null,
        },
      },
      200,
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Failed to get verification challenge:", error);
    throw new ApiError(
      500,
      error instanceof Error
        ? error.message
        : "Failed to get verification challenge",
    );
  }
}

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Get verification challenge",
    description: "Returns the current verification challenge for the agent.",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Challenge",
        content: {
          "application/json": { schema: verificationChallengeSuccessSchema },
        },
      },
      503: verificationUnavailableResponse,
      ...stdResponses,
    },
  }),
  async (c) => {
    const { agentId } = c.req.valid("param");
    return handleChallengeRequest(c, agentId, false);
  },
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Agents"],
    summary: "Refresh verification challenge",
    description:
      'Optional body `{ "regenerate": true }` to issue a new challenge and invalidate the previous.',
    security,
    request: {
      params: paramsSchema,
      body: {
        content: {
          "application/json": { schema: verificationChallengePostBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: "Challenge",
        content: {
          "application/json": { schema: verificationChallengeSuccessSchema },
        },
      },
      503: verificationUnavailableResponse,
      ...stdResponses,
    },
  }),
  async (c) => {
    const { agentId } = c.req.valid("param");
    // Body is optional; default regenerate to false if absent/invalid
    let regenerate = false;
    try {
      const body = await c.req.json();
      const parsed = verificationChallengePostBodySchema.safeParse(body);
      if (parsed.success) {
        regenerate = parsed.data.regenerate ?? false;
      }
    } catch {
      // No body or invalid JSON — keep regenerate=false
    }
    return handleChallengeRequest(c, agentId, regenerate);
  },
);

export const { GET, POST } = nextHandlers(app);
export default app;
