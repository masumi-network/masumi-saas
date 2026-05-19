import prisma from "@masumi/database/client";

import {
  getAdminAgentsData,
  getAdminAgentsQuerySchema,
} from "@/lib/api/admin.server";
import { getAuthenticatedOrThrow, isAdminUser } from "@/lib/auth/utils";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/admin/agents");

app.get("/", async (c) => {
  const { user } = await getAuthenticatedOrThrow(c.req.raw, {
    requireEmailVerified: false,
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!isAdminUser({ id: user.id, role: dbUser?.role ?? undefined })) {
    return c.json({ success: false as const, error: "Forbidden" }, 403);
  }

  const url = new URL(c.req.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());
  const queryResult = getAdminAgentsQuerySchema.safeParse(rawParams);
  if (!queryResult.success) {
    return c.json(
      {
        success: false as const,
        error: queryResult.error.issues.map((e) => e.message).join(", "),
      },
      400,
    );
  }

  try {
    const result = await getAdminAgentsData(queryResult.data);
    if (!result.success) {
      return c.json({ success: false as const, error: result.error }, 500);
    }
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    rethrowIfAuthOrCreditsError(error);
    console.error("Failed to fetch admin agents:", error);
    throw new ApiError(500, "Failed to load agents");
  }
});

export const { GET } = nextHandlers(app);
export default app;
