import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { dashboardOverviewQuerySchema } from "@/lib/schemas";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type DashboardOverviewApiResponse =
  | { success: true; data: DashboardOverview }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const queryResult = dashboardOverviewQuerySchema.safeParse({
      network: request.nextUrl.searchParams.get("network"),
    });
    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryResult.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 },
      );
    }
    const network = queryResult.data.network;
    requireNetworkedOidcApiScope(authContext, {
      resource: "dashboard",
      action: "read",
      network,
    });

    const data = await getDashboardOverview(authContext.user.id, network);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get dashboard overview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard overview" },
      { status: 500 },
    );
  }
}
