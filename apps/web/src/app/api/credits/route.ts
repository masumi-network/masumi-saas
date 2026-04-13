import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getCreditBalance } from "@/lib/credits/service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const balance = await getCreditBalance(authContext.user.id);

    return NextResponse.json({
      success: true,
      data: {
        creditsRemaining: balance.creditsRemaining,
        updatedAt: balance.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("GET /api/credits:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load credits" },
      { status: 500 },
    );
  }
}
