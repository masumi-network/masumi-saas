import { createRoute } from "@hono/zod-openapi";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { getCreditBalance } from "@/lib/credits/service";
import {
  creditsBalanceSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credits");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Credits"],
    summary: "Get remaining credits",
    description:
      "Canonical credits endpoint for the authenticated SaaS API. Returns the authenticated user’s remaining write credits.",
    security,
    responses: {
      200: {
        description: "Current balance",
        content: {
          "application/json": { schema: creditsBalanceSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const balance = await getCreditBalance(authContext.user.id);

    return c.json(
      {
        success: true as const,
        data: {
          creditsRemaining: balance.creditsRemaining,
          updatedAt: balance.updatedAt.toISOString(),
        },
      },
      200,
    );
  },
);

export const { GET } = nextHandlers(app);
export default app;
