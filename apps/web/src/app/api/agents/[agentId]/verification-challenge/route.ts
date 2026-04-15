import prisma from "@masumi/database/client";
import { randomBytes, randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { apiError } from "@/lib/api/error";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";

import contract, { bodySchema } from "./route.contract";

/**
 * GET or POST /api/agents/[agentId]/verification-challenge
 * Returns the current verification challenge for the agent, or generates a new one.
 * POST with { regenerate: true } to generate a new challenge (invalidates the previous).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return handleChallengeRequest(request, params, false);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const regenerate = parsed.success ? (parsed.data.regenerate ?? false) : false;
  return handleChallengeRequest(request, params, regenerate);
}

async function handleChallengeRequest(
  request: NextRequest,
  params: Promise<{ agentId: string }>,
  regenerate: boolean,
) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return apiError(
        verificationFeatureCopy.agentVerificationUnavailableDescription,
        503,
        undefined,
        { contract, method: "GET" },
      );
    }

    const authContext = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;

    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return apiError("Agent not found", 404, undefined, {
        contract,
        method: "GET",
      });
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "write",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    if (agent.registrationState !== "RegistrationConfirmed") {
      return apiError(
        `Agent must be registered. Current state: ${agent.registrationState}`,
        400,
        undefined,
        { contract, method: "GET" },
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

    return contractJsonResponse(contract, regenerate ? "POST" : "GET", 200, {
      success: true,
      data: {
        challenge,
        secret,
        generatedAt: generatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get verification challenge:", error);
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to get verification challenge",
      500,
      undefined,
      { contract, method: regenerate ? "POST" : "GET" },
    );
  }
}
