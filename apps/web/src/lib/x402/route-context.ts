import type { OpenAPIHono } from "@hono/zod-openapi";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  getCaip2NetworkLimitFromAuth,
  rethrowIfHttpError,
} from "@/lib/x402/route-support";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";

export type X402App = OpenAPIHono<Record<string, never>>;

export function x402Scope(
  authContext: Awaited<ReturnType<typeof getAuthenticatedOrThrow>>,
  action: "read" | "write" = "read",
) {
  return {
    userId: authContext.user.id,
    organizationId: authContext.activeOrganizationId,
    caip2NetworkLimit: getCaip2NetworkLimitFromAuth(authContext, action),
  };
}

export function handleRouteError(error: unknown, label: string): never {
  if (error instanceof ApiError) throw error;
  rethrowIfAuthOrCreditsError(error);
  rethrowIfHttpError(error);
  console.error(`[x402] ${label}:`, error);
  throw new ApiError(500, label);
}
