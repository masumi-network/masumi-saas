import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getAgentVerificationSchemaSaid } from "@/lib/veridian";

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedOrThrow(request);

    const schemaSaid = getAgentVerificationSchemaSaid();

    return NextResponse.json({
      success: true,
      data: { schemaSaid },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get schema SAID:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get schema SAID" },
      { status: 500 },
    );
  }
}
