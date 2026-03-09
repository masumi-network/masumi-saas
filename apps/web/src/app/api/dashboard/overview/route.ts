import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type DashboardOverviewApiResponse =
  | { success: true; data: DashboardOverview }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);

    const networkParam = request.nextUrl.searchParams.get("network");
    const network =
      networkParam === "Mainnet" || networkParam === "Preprod"
        ? networkParam
        : "Preprod";

    const data = await getDashboardOverview(user.id, network);
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
