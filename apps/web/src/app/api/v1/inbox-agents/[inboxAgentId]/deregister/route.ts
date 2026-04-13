import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { resolveInboxSmartContractAddress } from "@/lib/inbox-agents/server";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";

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
      return NextResponse.json(
        {
          success: false,
          error:
            inboxAgentIdResult.error.issues
              .map((issue) => issue.message)
              .join(", ") || "Invalid inbox agent ID",
        },
        { status: 400 },
      );
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Payment node not configured for user" },
        { status: 403 },
      );
    }

    const inboxAgent = await client.getRegistryInboxById({
      id: inboxAgentIdResult.data,
      network,
    });
    if (!inboxAgent) {
      return NextResponse.json(
        { success: false, error: "Inbox agent not found" },
        { status: 404 },
      );
    }

    if (inboxAgent.state !== "RegistrationConfirmed") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Inbox agent can only be deregistered after registration is confirmed",
        },
        { status: 400 },
      );
    }

    if (!inboxAgent.agentIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: "Inbox agent is missing its on-chain identifier",
        },
        { status: 400 },
      );
    }

    const smartContractAddress = await resolveInboxSmartContractAddress(
      client,
      network,
      inboxAgent.SmartContractWallet.walletVkey,
    );
    if (!smartContractAddress) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not resolve the payment source for this inbox agent registration",
        },
        { status: 400 },
      );
    }

    const deregistered = await client.deregisterInboxAgent({
      network,
      agentIdentifier: inboxAgent.agentIdentifier,
      smartContractAddress,
    });

    return NextResponse.json({ success: true, data: deregistered });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to deregister inbox agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to deregister inbox agent" },
      { status: 500 },
    );
  }
}
