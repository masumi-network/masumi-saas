import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { deleteAgentAction } from "@/lib/actions/agent.action";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: authContext.user.id,
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
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

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
    const authContext = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: authContext.user.id,
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
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });
    const result = await deleteAgentAction(agentId, authContext.user.id);
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
