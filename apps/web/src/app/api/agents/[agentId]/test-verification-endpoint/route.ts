import { NextResponse } from "next/server";

import { fetchAgentCredentialChallenge } from "@/lib/agent-verification";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { apiError } from "@/lib/api/error";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

/**
 * POST /api/agents/[agentId]/test-verification-endpoint
 * Tests that the agent's /get-credential endpoint returns the correct HMAC.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;

    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return apiError("Agent not found", 404);
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
      );
    }

    const challenge = agent.verificationChallenge;
    const secret = agent.verificationSecret;

    if (!challenge || !secret) {
      return apiError(
        "No verification challenge or secret. Generate one from the dialog first.",
        400,
      );
    }

    const result = await fetchAgentCredentialChallenge(
      agent.apiUrl,
      challenge,
      secret,
    );

    if (!result.success) {
      return apiError(result.error, 400);
    }

    return NextResponse.json({
      success: true,
      data: { message: "Endpoint is working correctly." },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to test verification endpoint:", error);
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to test verification endpoint",
      500,
    );
  }
}
