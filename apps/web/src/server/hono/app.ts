import { OpenAPIHono } from "@hono/zod-openapi";

import { handleApiError } from "./errors";
import { type AuthVariables } from "./middleware/auth";

export type ApiEnv = {
  Variables: Partial<AuthVariables>;
};

/**
 * Per-route Hono app. `basePath` MUST match the Next folder route under /api/*
 * so Hono's router matches the incoming request URL. OpenAPI-style path
 * parameters (`{agentId}`) are converted to Hono router syntax (`:agentId`)
 * so dynamic basePaths still match incoming URLs.
 *
 * `defaultHook` formats Zod validation failures into the
 * `{ success: false, error, details }` shape used across the API.
 */
export function createApiApp(basePath: string) {
  const honoBasePath = basePath.replace(/\{([^}]+)\}/g, ":$1");
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false as const,
            error: result.error.issues.map((issue) => issue.message).join("; "),
          },
          400,
        );
      }
    },
  }).basePath(honoBasePath);
  app.onError(handleApiError);
  return app;
}
