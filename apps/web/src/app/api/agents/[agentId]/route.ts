import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } },
) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const agent = await prisma.agent.findFirst({
      where: {
        id: params.agentId,
        userId: user.id,
      },
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

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Failed to get agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get agent",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } },
) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const agent = await prisma.agent.findFirst({
      where: {
        id: params.agentId,
        userId: user.id,
      },
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

    await prisma.agent.delete({
      where: {
        id: params.agentId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete agent",
      },
      { status: 500 },
    );
  }
}
