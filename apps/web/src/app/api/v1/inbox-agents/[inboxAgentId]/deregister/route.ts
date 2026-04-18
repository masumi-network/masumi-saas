import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  getOwnedInboxAgentForUser,
  resolveInboxSmartContractAddress,
  saveInboxAgentReference,
} from "@/lib/inbox-agents/server";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";

import contract from "../../../../../pay/api/v1/inbox-agents/[inboxAgentId]/deregister/route.contract";

export async function POST(
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
      return contractJsonResponse(contract, "POST", 400, {
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
      return contractJsonResponse(contract, "POST", 404, {
        success: false,
        error: "Inbox agent not found",
      });
    }

    const client = createInboxAdminPaymentNodeClient();
    const inboxAgent = ownedInboxAgent.entry;

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

    const smartContractAddress =
      ownedInboxAgent.smartContractAddress ??
      (await resolveInboxSmartContractAddress(
        client,
        network,
        inboxAgent.SmartContractWallet.walletVkey,
      ));
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

    if (ownedInboxAgent.reference) {
      await saveInboxAgentReference({
        userId: authContext.user.id,
        network,
        entry: deregistered,
        executingWallet: ownedInboxAgent.executingWallet,
        smartContractAddress,
      });
    }

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
