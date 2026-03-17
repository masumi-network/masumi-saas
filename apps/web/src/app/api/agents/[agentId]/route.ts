import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { deleteAgentAction } from "@/lib/actions/agent.action";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
      include: { agentReference: true },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent not found",
        },
        { status: 404 },
      );
    }

    const data = shapeAgentWithMergedMetadata(agent);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get agent" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    await getAuthenticatedOrThrow(request);
    const { agentId } = await params;
    const result = await deleteAgentAction(agentId);
    if (!result.success) {
      const status = result.error === "Agent not found" ? 404 : 400;
      return NextResponse.json(
        { success: false, error: result.error },
        { status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete agent" },
      { status: 500 },
    );
  }
}
