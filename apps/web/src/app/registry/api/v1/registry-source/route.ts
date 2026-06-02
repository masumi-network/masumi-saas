import prisma from "@masumi/database/client";
import type { Context } from "hono";

import { getAuthenticatedOrThrow, isAdminUser } from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  readOptionalRequestBody,
  resolveRegistrySharedTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "registry-source";
const UPSTREAM_PATH = "/registry-source/";

const app = createApiApp("/");

async function handleRequest(
  c: Context,
  method: "GET" | "POST" | "PATCH" | "DELETE",
) {
  const request = c.req.raw;
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const dbUser = await prisma.user.findUnique({
      where: { id: authContext.user.id },
      select: { role: true },
    });

    if (!isAdminUser({ id: authContext.user.id, role: dbUser?.role })) {
      return c.json({ success: false as const, error: "Forbidden" }, 403);
    }

    const upstream = resolveRegistrySharedTokenUpstream();
    if (!upstream.ok) {
      return c.json(
        { success: false as const, error: upstream.error },
        upstream.status as never,
      );
    }

    const headers = buildUpstreamHeaders(request, upstream.token);
    const body =
      method === "GET" ? undefined : await readOptionalRequestBody(request);
    const response = await fetch(
      `${upstream.baseUrl}${UPSTREAM_PATH}${new URL(c.req.url).search}`,
      {
        method,
        headers,
        body,
      },
    );

    return toUpstreamResponse(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    rethrowIfAuthOrCreditsError(error);
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    throw new ApiError(500, "Proxy request failed");
  }
}

app.get("*", (c) => handleRequest(c, "GET"));
app.post("*", (c) => handleRequest(c, "POST"));
app.patch("*", (c) => handleRequest(c, "PATCH"));
app.delete("*", (c) => handleRequest(c, "DELETE"));

export const { GET, POST, PATCH, DELETE } = nextHandlers(app);
export default app;
