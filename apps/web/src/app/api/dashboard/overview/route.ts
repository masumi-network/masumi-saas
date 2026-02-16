import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type DashboardOverviewApiResponse =
  | { success: true; data: DashboardOverview }
  | { success: false; error: string };

export async function GET() {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const data = await getDashboardOverview(user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const isUnauthorized =
      error instanceof Error && error.message === "Unauthorized";
    const status = isUnauthorized ? 401 : 500;
    if (!isUnauthorized) {
      console.error("Failed to get dashboard overview:", error);
    }
    return NextResponse.json(
      {
        success: false,
        error: isUnauthorized
          ? "Unauthorized"
          : "Failed to load dashboard overview",
      },
      { status },
    );
  }
}
