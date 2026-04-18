import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  deleteInboxAgentReference,
  getOwnedInboxAgentForUser,
} from "@/lib/inbox-agents/server";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";

import contract from "../../../../pay/api/v1/inbox-agents/[inboxAgentId]/route.contract";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ inboxAgentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request);
    const network = getEffectivePaymentNetwork(request);
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

    const ownedInboxAgent = await getOwnedInboxAgentForUser({
      userId: authContext.user.id,
      network,
      inboxAgentId: inboxAgentIdResult.data,
    });
    if (!ownedInboxAgent) {
      return contractJsonResponse(contract, "DELETE", 404, {
        success: false,
        error: "Inbox agent not found",
      });
    }

    const inboxAgent = ownedInboxAgent.entry;

    if (ownedInboxAgent.remoteMissing && ownedInboxAgent.reference) {
      await deleteInboxAgentReference(ownedInboxAgent.reference.id);
      return contractJsonResponse(contract, "DELETE", 200, {
        success: true,
        data: inboxAgent,
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

    const client = createInboxAdminPaymentNodeClient();
    const deleted = await client.deleteRegistryInboxEntry(inboxAgent.id);
    if (ownedInboxAgent.reference) {
      await deleteInboxAgentReference(ownedInboxAgent.reference.id);
    }

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
