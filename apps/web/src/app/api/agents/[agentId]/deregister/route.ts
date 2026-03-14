import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { deregisterAgentAction } from "@/lib/actions/agent.action";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const result = await deregisterAgentAction(agentId);
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
