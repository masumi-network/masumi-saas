import { completeOnChainRegistration } from "@/lib/agent-registration";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";

import contract from "./route.contract";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(_request);
    const { agentId } = await params;
    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });
    if (!agent) {
      return contractJsonResponse(contract, "POST", 404, {
        success: false,
        error: "Agent not found",
      });
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "write",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    const result = await completeOnChainRegistration(
      agentId,
      authContext.user.id,
    );

    if (result.status === "registered") {
      return contractJsonResponse(contract, "POST", 200, {
        success: true,
        data: result.data,
        status: "registered",
      });
    }
    if (result.status === "pending") {
      return contractJsonResponse(contract, "POST", 202, {
        success: true,
        status: "pending",
        message: "Wallet not yet funded. Poll again in a few seconds.",
      });
    }
    return contractJsonResponse(contract, "POST", 400, {
      success: false,
      error: result.error,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to complete agent registration:", error);
    return contractJsonResponse(contract, "POST", 500, {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to complete registration",
    });
  }
}
