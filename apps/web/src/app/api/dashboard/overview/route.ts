import { createRoute } from "@hono/zod-openapi";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { dashboardOverviewQuerySchema } from "@/lib/schemas";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import {
  dashboardOverviewSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import type { DashboardOverview } from "@/lib/types/dashboard";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export type DashboardOverviewApiResponse =
  | { success: true; data: DashboardOverview }
  | { success: false; error: string };

const app = createApiApp("/api/dashboard/overview");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Dashboard"],
    summary: "Dashboard overview",
    description:
      "User, organizations, agents, API keys, balance snapshot, KYC hints — scoped to the authenticated user.",
    security,
    request: {
      query: dashboardOverviewQuerySchema,
    },
    responses: {
      200: {
        description: "Overview",
        content: {
          "application/json": { schema: dashboardOverviewSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    const { network } = c.req.valid("query");
    requireNetworkedOidcApiScope(authContext, {
      resource: "dashboard",
      action: "read",
      network,
    });

    try {
      const data = await getDashboardOverview(authContext.user.id, network);
      return c.json({ success: true as const, data }, 200);
    } catch (error) {
      console.error("Failed to get dashboard overview:", error);
      throw new ApiError(500, "Failed to load dashboard overview");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
