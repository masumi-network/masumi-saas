"use server";

import { headers } from "next/headers";

import {
  dashboardApiClient,
  type GetDashboardOverviewResult,
} from "@/lib/api/dashboard.client";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type { DashboardOverview };

export async function getDashboardOverviewAction(): Promise<
  { success: true; data: DashboardOverview } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const headersList = await headers();

    const baseUrl = resolveBaseUrl(headersList);
    if (!isAllowedOrigin(baseUrl)) {
      return { success: true, data: await getDashboardOverview(user.id) };
    }

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

function resolveBaseUrl(headersList: Headers): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;

  const host =
    headersList.get("x-forwarded-host") ??
    headersList.get("host") ??
    "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function isAllowedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl) {
      const appHost = new URL(appUrl).hostname.toLowerCase();
      return host === appHost;
    }
    return false;
  } catch {
    return false;
  }
}
