import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getOwnedInboxAgentByAgentIdentifierForUser } from "@/lib/inbox-agents/server";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const network = getEffectivePaymentNetwork(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
      action: "read",
      network,
    });

    const agentIdentifier = request.nextUrl.searchParams.get("agentIdentifier");
    if (!agentIdentifier) {
      return NextResponse.json(
        { success: false, error: "agentIdentifier is required" },
        { status: 400 },
      );
    }

    const ownedInboxAgent = await getOwnedInboxAgentByAgentIdentifierForUser({
      userId: authContext.user.id,
      network,
      agentIdentifier,
    });
    if (!ownedInboxAgent) {
      return NextResponse.json(
        { success: false, error: "Inbox agent not found" },
        { status: 404 },
      );
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Payment node unavailable" },
        { status: 503 },
      );
    }

    const metadata = await client.getRegistryInboxByAgentIdentifier({
      agentIdentifier,
      network,
    });
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: "Inbox agent not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: metadata });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[Registry Discovery:inbox-agent-identifier]", error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
