import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { getAgentVerificationSchemaSaid } from "@/lib/veridian";

export async function GET(_request: NextRequest) {
  try {
    await getAuthenticatedHeaders();

    const schemaSaid = getAgentVerificationSchemaSaid();

    return NextResponse.json({
      success: true,
      data: { schemaSaid },
    });
  } catch (error) {
    console.error("Failed to get schema SAID:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get schema SAID",
      },
      { status: 500 },
    );
  }
}
