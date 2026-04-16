import { NextRequest } from "next/server";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { deregisterAgentForUser } from "@/lib/deregister-agent";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";

import contract from "./route.contract";

function networkFromRequest(request: NextRequest): PaymentNodeNetwork {
  const value = request.cookies.get("payment_network")?.value;
  return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request);
    const { user } = authContext;
    const { agentId: rawAgentId } = await params;
    const agentIdResult = agentIdRouteParamSchema.safeParse(rawAgentId);
    if (!agentIdResult.success) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error:
          agentIdResult.error.issues.map((e) => e.message).join(", ") ||
          "Invalid agent ID",
      });
    }
    const agentId = agentIdResult.data;
    const networkFallback = networkFromRequest(request);
    const agent = await getWalletOwnedAgentForUser({
      userId: user.id,
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
      network:
        agent.networkIdentifier === "Mainnet" ? "Mainnet" : networkFallback,
    });

    const result = await deregisterAgentForUser(agentId, user.id, {
      networkFallback,
    });
    if (!result.success) {
      const status =
        result.error === "Agent not found"
          ? 404
          : result.error === "Agent is not registered on the network"
            ? 400
            : 400;
      return contractJsonResponse(contract, "POST", status, {
        success: false,
        error: result.error,
      });
    }
    return contractJsonResponse(contract, "POST", 200, { success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    if (isPaymentNodeConfigError(error)) {
      return contractJsonResponse(contract, "POST", 500, {
        success: false,
        error: error.message,
      });
    }
    console.error("Failed to deregister agent:", error);
    return contractJsonResponse(contract, "POST", 500, {
      success: false,
      error: "Failed to deregister agent",
    });
  }
}
