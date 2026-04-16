import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";

import contract from "../../../../pay/api/v1/inbox-agents/[inboxAgentId]/route.contract";

function getNetworkFromRequest(request: NextRequest): "Mainnet" | "Preprod" {
  const value =
    request.nextUrl.searchParams.get("network") ??
    request.cookies.get("payment_network")?.value;
  return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
}

export async function DELETE(
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
      return contractJsonResponse(contract, "DELETE", 400, {
        success: false,
        error:
          inboxAgentIdResult.error.issues
            .map((issue) => issue.message)
            .join(", ") || "Invalid inbox agent ID",
      });
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "DELETE", 403, {
        success: false,
        error: "Payment node not configured for user",
      });
    }

    const inboxAgent = await client.getRegistryInboxById({
      id: inboxAgentIdResult.data,
      network,
    });
    if (!inboxAgent) {
      return contractJsonResponse(contract, "DELETE", 404, {
        success: false,
        error: "Inbox agent not found",
      });
    }

    if (
      inboxAgent.state !== "RegistrationFailed" &&
      inboxAgent.state !== "DeregistrationConfirmed"
    ) {
      return contractJsonResponse(contract, "DELETE", 400, {
        success: false,
        error:
          "Inbox agent can only be deleted after a failed registration or completed deregistration",
      });
    }

    const deleted = await client.deleteRegistryInboxEntry(inboxAgent.id);

    return contractJsonResponse(contract, "DELETE", 200, {
      success: true,
      data: deleted,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to delete inbox agent:", error);
    return contractJsonResponse(contract, "DELETE", 500, {
      success: false,
      error: "Failed to delete inbox agent",
    });
  }
}
