import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { agentVerifyQuerySchema } from "@/lib/schemas";
import { verifyAgentResultSchema } from "@/lib/swagger/generator";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["public-v1"] as const };

const errorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const app = createApiApp("/api/v1/agents/verify");

app.use("*", honoCors(["GET", "OPTIONS"]));

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Verify agent identifier",
    description:
      "Looks up a public agent by `agentIdentifier` and reports whether it currently has an active verification credential.",
    request: { query: agentVerifyQuerySchema },
    responses: {
      200: {
        description: "Verification result",
        content: { "application/json": { schema: verifyAgentResultSchema } },
      },
      400: {
        description: "Bad Request — invalid query parameters",
        content: { "application/json": { schema: errorSchema } },
      },
      429: {
        description:
          "Too Many Requests — rate limit exceeded. Check Retry-After header.",
        content: { "application/json": { schema: errorSchema } },
      },
      500: {
        description: "Internal Server Error",
        content: { "application/json": { schema: errorSchema } },
      },
    },
  }),
  async (c) => {
    const { rl } = await checkRateLimitOrRespond(
      c.req.raw,
      "public-agent-verify",
    );

    const { agentIdentifier } = c.req.valid("query");

    const respondNotVerified = () => {
      const res = c.json(
        { success: true as const, data: { verified: false as const } },
        200,
      );
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      res.headers.set(
        "Cache-Control",
        "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      );
      return res;
    };

    try {
      const agent = await prisma.agent.findFirst({
        where: { agentIdentifier },
        select: {
          id: true,
          name: true,
          apiUrl: true,
          verificationStatus: true,
          veridianCredentialId: true,
        },
      });

      if (!agent || agent.verificationStatus !== "VERIFIED") {
        return respondNotVerified();
      }

      const credential = await prisma.veridianCredential.findFirst({
        where: { agentId: agent.id, status: "ISSUED" },
        select: { credentialId: true, expiresAt: true },
        orderBy: { issuedAt: "desc" },
      });

      if (!credential) {
        return respondNotVerified();
      }

      const isExpired =
        credential.expiresAt !== null && credential.expiresAt < new Date();

      const res = c.json(
        {
          success: true as const,
          data: {
            verified: !isExpired,
            credentialId: credential.credentialId,
            expiresAt: credential.expiresAt
              ? credential.expiresAt.toISOString()
              : null,
            agentName: agent.name,
            apiUrl: agent.apiUrl,
          },
        },
        200,
      );
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      res.headers.set(
        "Cache-Control",
        "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      );
      return res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Failed to verify agent:", error);
      throw new ApiError(500, "Failed to verify agent");
    }
  },
);

export const { GET, OPTIONS } = nextHandlers(app);
export default app;
