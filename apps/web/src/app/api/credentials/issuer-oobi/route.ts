import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getIssuerOobi } from "@/lib/veridian";

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedOrThrow(request);

    const issuerOobi = await getIssuerOobi();

    return NextResponse.json({
      success: true,
      data: { oobi: issuerOobi },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get issuer OOBI:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get issuer OOBI" },
      { status: 500 },
    );
  }
}
