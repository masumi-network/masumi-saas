import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import {
  getAdminAgentsData,
  getAdminAgentsQuerySchema,
} from "@/lib/api/admin.server";
import { getAuthenticatedOrThrow, isAdminUser } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/admin/agents");

const adminAgentRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiUrl: z.string(),
  registrationState: z.string(),
  verificationStatus: z.string().nullable(),
  agentIdentifier: z.string().nullable(),
  createdAt: z.string(),
  ownerName: z.string(),
  ownerEmail: z.string(),
});

const adminAgentsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      agents: z.array(adminAgentRowSchema),
      pagination: z.object({
        currentPage: z.number().int(),
        totalPages: z.number().int(),
        total: z.number().int(),
        limit: z.number().int(),
      }),
      search: z.string(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        agents: [
          {
            id: "cmlf6gswz0000x1uctad958tq",
            name: "Research assistant",
            apiUrl: "https://agent.example.com/mip",
            registrationState: "RegistrationConfirmed",
            verificationStatus: "VERIFIED",
            agentIdentifier: "policy1.assetname1",
            createdAt: "2026-01-15T12:00:00.000Z",
            ownerName: "Ada Lovelace",
            ownerEmail: "ada@example.com",
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          total: 1,
          limit: 10,
        },
        search: "",
      },
    },
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Admin"],
    summary: "List agents for admin review",
    description:
      "Returns a paginated list of agents across users. Requires an authenticated admin user.",
    security,
    request: {
      query: getAdminAgentsQuerySchema,
    },
    responses: {
      200: {
        description: "Admin agents list",
        content: {
          "application/json": { schema: adminAgentsSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
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

    const query = c.req.valid("query");

    try {
      const result = await getAdminAgentsData(query);
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
  },
);

export const { GET } = nextHandlers(app);
export default app;
