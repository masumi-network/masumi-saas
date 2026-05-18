import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { rejectOidcAccessTokenAuth } from "@/lib/auth/oidc-api-permissions";
import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { authConfig } from "@/lib/config/auth.config";
import {
  apiKeyStatusKeySchema,
  apiKeyStatusSessionSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/api-key-status");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["API keys"],
    summary: "API key status",
    description:
      "Returns whether the caller is authenticated with a **browser session** or a **Masumi SaaS API key** (`x-api-key` / `Authorization: Bearer`). For API key auth, includes public metadata for that key (id, name, prefix, start fragment). Does **not** echo the secret key.",
    security,
    responses: {
      200: {
        description:
          "`authMethod` is `session` for cookie auth, or `apiKey` when the request was authenticated with an API key.",
        content: {
          "application/json": {
            schema: z.union([apiKeyStatusSessionSchema, apiKeyStatusKeySchema]),
          },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    rejectOidcAccessTokenAuth(
      authContext,
      "OIDC access tokens are not supported for /api/api-key-status",
    );

    try {
      const sess = getBetterAuthInnerSession(authContext.session);
      const token = sess?.token;
      const isApiKeyAuth =
        typeof token === "string" &&
        token.startsWith(authConfig.apiKey.defaultKeyPrefix);

      if (isApiKeyAuth && typeof sess?.id === "string") {
        const keyRow = await prisma.apikey.findFirst({
          where: { id: sess.id, userId: authContext.user.id },
          select: {
            id: true,
            name: true,
            prefix: true,
            start: true,
            enabled: true,
            createdAt: true,
            lastRequest: true,
          },
        });

        if (!keyRow) {
          throw new ApiError(404, "API key not found");
        }

        return c.json(
          {
            success: true as const,
            data: {
              authMethod: "apiKey" as const,
              userId: authContext.user.id,
              key: {
                id: keyRow.id,
                name: keyRow.name,
                prefix: keyRow.prefix,
                start: keyRow.start,
                enabled: keyRow.enabled ?? true,
                createdAt: keyRow.createdAt.toISOString(),
                lastRequest: keyRow.lastRequest?.toISOString() ?? null,
              },
            },
          },
          200,
        );
      }

      return c.json(
        {
          success: true as const,
          data: {
            authMethod: "session" as const,
            userId: authContext.user.id,
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("GET /api/api-key-status:", error);
      throw new ApiError(500, "Failed to load API key status");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
