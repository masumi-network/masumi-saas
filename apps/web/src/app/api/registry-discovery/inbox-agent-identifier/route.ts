import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  getRegisteredOwnedInboxAgentReferenceByAgentIdentifier,
} from "@/lib/inbox-agents/server";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
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

    const ownedReference =
      await getRegisteredOwnedInboxAgentReferenceByAgentIdentifier({
        userId: authContext.user.id,
        network,
        agentIdentifier,
      });
    if (!ownedReference) {
      return NextResponse.json(
        { success: false, error: "Inbox agent not found" },
        { status: 404 },
      );
    }

    const client = createInboxAdminPaymentNodeClient();
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
    if (isPaymentNodeConfigError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 503 },
      );
    }
    console.error("[Registry Discovery:inbox-agent-identifier]", error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
