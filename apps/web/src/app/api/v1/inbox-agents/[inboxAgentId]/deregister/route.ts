import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { resolveInboxSmartContractAddress } from "@/lib/inbox-agents/server";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";

import contract from "../../../../../pay/api/v1/inbox-agents/[inboxAgentId]/deregister/route.contract";

function getNetworkFromRequest(request: NextRequest): "Mainnet" | "Preprod" {
  const value =
    request.nextUrl.searchParams.get("network") ??
    request.cookies.get("payment_network")?.value;
  return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inboxAgentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request);
    const network = getNetworkFromRequest(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
      action: "write",
      network,
    });

    const { inboxAgentId: rawInboxAgentId } = await params;
    const inboxAgentIdResult =
      inboxAgentIdRouteParamSchema.safeParse(rawInboxAgentId);
    if (!inboxAgentIdResult.success) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error:
          inboxAgentIdResult.error.issues
            .map((issue) => issue.message)
            .join(", ") || "Invalid inbox agent ID",
      });
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "POST", 403, {
        success: false,
        error: "Payment node not configured for user",
      });
    }

    const inboxAgent = await client.getRegistryInboxById({
      id: inboxAgentIdResult.data,
      network,
    });
    if (!inboxAgent) {
      return contractJsonResponse(contract, "POST", 404, {
        success: false,
        error: "Inbox agent not found",
      });
    }

    if (inboxAgent.state !== "RegistrationConfirmed") {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error:
          "Inbox agent can only be deregistered after registration is confirmed",
      });
    }

    if (!inboxAgent.agentIdentifier) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: "Inbox agent is missing its on-chain identifier",
      });
    }

    const smartContractAddress = await resolveInboxSmartContractAddress(
      client,
      network,
      inboxAgent.SmartContractWallet.walletVkey,
    );
    if (!smartContractAddress) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error:
          "Could not resolve the payment source for this inbox agent registration",
      });
    }

    const deregistered = await client.deregisterInboxAgent({
      network,
      agentIdentifier: inboxAgent.agentIdentifier,
      smartContractAddress,
    });

    return contractJsonResponse(contract, "POST", 200, {
      success: true,
      data: deregistered,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to deregister inbox agent:", error);
    return contractJsonResponse(contract, "POST", 500, {
      success: false,
      error: "Failed to deregister inbox agent",
    });
  }
}
