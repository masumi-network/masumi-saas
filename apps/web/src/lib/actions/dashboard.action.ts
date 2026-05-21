"use server";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import type { DashboardOverview } from "@/lib/types/dashboard";

export type { DashboardOverview };

/**
 * Server action invoked by the dashboard RSC. We call the underlying service
 * directly instead of HTTP-looping back through `/api/dashboard/overview`:
 *   - Server actions are always session/cookie-authenticated. OIDC bearer
 *     tokens cannot reach a server action, so the API route's
 *     `requireNetworkedOidcApiScope` check is a no-op in this context anyway.
 *   - Avoids a same-process TCP round trip and lets React `cache()` /
 *     Next request memoisation in the service layer kick in.
 */
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

    const data = await getDashboardOverview(user.id, resolvedNetwork);
    return { success: true, data };
  } catch (error) {
    console.error("Failed to get dashboard overview:", error);
    return {
      success: false,
      error: "Failed to load dashboard overview",
    };
  }
}
