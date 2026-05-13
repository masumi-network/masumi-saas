import { NextRequest } from "next/server";

import { deleteAgentAction } from "@/lib/actions/agent.action";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";

import contract from "./route.contract";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { agentId } = await params;

    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return contractJsonResponse(contract, "GET", 404, {
        success: false,
        error: "Agent not found",
      });
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    const data = shapeAgentWithMergedMetadata(agent);

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agent:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to get agent",
    });
  }
}

export async function DELETE(
  request: NextRequest,
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
      return contractJsonResponse(contract, "DELETE", 404, {
        success: false,
        error: "Agent not found",
      });
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "write",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });
    const result = await deleteAgentAction(agentId, authContext.user.id);
    if (!result.success) {
      const status = result.error === "Agent not found" ? 404 : 400;
      return contractJsonResponse(contract, "DELETE", status, {
        success: false,
        error: result.error,
      });
    }
    return contractJsonResponse(contract, "DELETE", 200, { success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to delete agent:", error);
    return contractJsonResponse(contract, "DELETE", 500, {
      success: false,
      error: "Failed to delete agent",
    });
  }
}
