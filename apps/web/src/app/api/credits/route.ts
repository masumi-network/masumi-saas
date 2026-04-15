import { NextRequest } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getCreditBalance } from "@/lib/credits/service";
import { contractJsonResponse } from "@/lib/openapi/contracts";

import contract from "./route.contract";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const balance = await getCreditBalance(authContext.user.id);

    return contractJsonResponse(contract, "GET", 200, {
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
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load credits",
    });
  }
}
