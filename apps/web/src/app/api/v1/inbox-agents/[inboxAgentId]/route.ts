import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";

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

    if (
      inboxAgent.state !== "RegistrationFailed" &&
      inboxAgent.state !== "DeregistrationConfirmed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Inbox agent can only be deleted after a failed registration or completed deregistration",
        },
        { status: 400 },
      );
    }

    const deleted = await client.deleteRegistryInboxEntry(inboxAgent.id);

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to delete inbox agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete inbox agent" },
      { status: 500 },
    );
  }
}
