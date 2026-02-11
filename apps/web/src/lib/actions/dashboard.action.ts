"use server";

import { headers } from "next/headers";

import {
  dashboardApiClient,
  type GetDashboardOverviewResult,
} from "@/lib/api/dashboard.client";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type { DashboardOverview };

export async function getDashboardOverviewAction(): Promise<
  { success: true; data: DashboardOverview } | { success: false; error: string }
> {
  try {
    await getAuthenticatedOrThrow();
    const headersList = await headers();

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? getBaseUrlFromHeaders(headersList);
    const cookie = headersList.get("cookie");

    const result: GetDashboardOverviewResult =
      await dashboardApiClient.getOverview({
        baseUrl,
        headers: cookie ? { cookie } : undefined,
      });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to get dashboard overview:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load dashboard overview",
    };
  }
}

function getBaseUrlFromHeaders(headers: Headers): string {
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
