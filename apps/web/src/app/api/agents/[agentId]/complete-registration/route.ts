import { NextResponse } from "next/server";

import { completeOnChainRegistration } from "@/lib/agent-registration";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow(_request);
    const { agentId } = await params;

    const result = await completeOnChainRegistration(agentId, user.id);

    if (result.status === "registered") {
      return NextResponse.json({
        success: true,
        data: result.data,
        status: "registered",
      });
    }
    if (result.status === "pending") {
      return NextResponse.json(
        {
          success: true,
          status: "pending",
          message: "Wallet not yet funded. Poll again in a few seconds.",
        },
        { status: 202 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to complete agent registration:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete registration",
      },
      { status: 500 },
    );
  }
}
