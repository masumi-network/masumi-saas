"use server";

import { headers } from "next/headers";

import {
  dashboardApiClient,
  type GetDashboardOverviewResult,
} from "@/lib/api/dashboard.client";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { appConfig } from "@/lib/config/app.config";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type { DashboardOverview };

export async function getDashboardOverviewAction(
  network?: "Mainnet" | "Preprod",
): Promise<
  { success: true; data: DashboardOverview } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow({
      requireEmailVerified: false,
    });
    const resolvedNetwork =
      network === "Mainnet" || network === "Preprod" ? network : "Preprod";
    const headersList = await headers();

    const baseUrl = resolveBaseUrl(headersList);
    if (!isAllowedOrigin(baseUrl)) {
      return {
        success: true,
        data: await getDashboardOverview(user.id, resolvedNetwork),
      };
    }

    // In production, header-derived host (x-forwarded-host, host) is spoofable.
    // Only use API call when we have a trusted configured URL.
    const hasConfiguredUrl = appConfig.appUrl !== "http://localhost:3000";
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && !hasConfiguredUrl) {
      return {
        success: true,
        data: await getDashboardOverview(user.id, resolvedNetwork),
      };
    }

    const cookie = headersList.get("cookie");

    const result: GetDashboardOverviewResult =
      await dashboardApiClient.getOverview({
        baseUrl,
        headers: cookie ? { cookie } : undefined,
        network: resolvedNetwork,
      });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to get dashboard overview:", error);
    return {
      success: false,
      error: "Failed to load dashboard overview",
    };
  }
}

function resolveBaseUrl(headersList: Headers): string {
  if (appConfig.appUrl !== "http://localhost:3000") return appConfig.appUrl;

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
    if (process.env.NODE_ENV === "development") {
      if (host === "localhost" || host === "127.0.0.1") return true;
    }
    if (appConfig.appUrl !== "http://localhost:3000") {
      const appHost = new URL(appConfig.appUrl).hostname.toLowerCase();
      return host === appHost;
    }
    return false;
  } catch {
    return false;
  }
}
