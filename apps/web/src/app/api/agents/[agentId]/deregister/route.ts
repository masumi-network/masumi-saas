import { NextRequest, NextResponse } from "next/server";

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
    const { user } = await getAuthenticatedOrThrow(request);
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
