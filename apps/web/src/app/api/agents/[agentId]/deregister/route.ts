import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { deregisterAgentForUser } from "@/lib/deregister-agent";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";

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
      return NextResponse.json(
        {
          success: false,
          error:
            agentIdResult.error.issues.map((e) => e.message).join(", ") ||
            "Invalid agent ID",
        },
        { status: 400 },
      );
    }
    const agentId = agentIdResult.data;
    const networkFallback = networkFromRequest(request);
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
      select: {
        id: true,
        networkIdentifier: true,
      },
    });
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 },
      );
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
      return NextResponse.json(
        { success: false, error: result.error },
        { status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to deregister agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to deregister agent" },
      { status: 500 },
    );
  }
}
