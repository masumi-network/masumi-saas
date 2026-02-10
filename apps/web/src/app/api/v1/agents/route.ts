import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { agentPaginationSchema, publicAgentSelect } from "@/lib/schemas/agent";

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVIEW"]).optional(),
});

export async function OPTIONS() {
  return handleCorsPreflightResponse();
}

export async function GET(request: NextRequest) {
  try {
    // 1. Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = checkRateLimit(`public-agents:${ip}`);

    if (!rl.allowed) {
      const res = NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        },
        { status: 429 },
      );
      res.headers.set(
        "Retry-After",
        String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
      );
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", "0");
      return addCorsHeaders(res);
    }

    // 2. Validate query params
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = querySchema.safeParse(params);
    if (!validation.success) {
      return addCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error: validation.error.issues.map((e) => e.message).join(", "),
          },
          { status: 400 },
        ),
      );
    }

    const { status } = validation.data;

    const paginationValidation = agentPaginationSchema.safeParse(params);
    const { page, limit } = paginationValidation.success
      ? paginationValidation.data
      : { page: 1, limit: 50 };

    // 3. Build where clause — default to APPROVED
    const where = {
      verificationStatus: status ?? "APPROVED",
    };

    // 4. Query
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        select: publicAgentSelect,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.agent.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 5. Return response
    const res = NextResponse.json({
      success: true,
      data: agents,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
    res.headers.set("X-RateLimit-Limit", String(rl.limit));
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return addCorsHeaders(res);
  } catch (error) {
    console.error("Failed to list agents:", error);
    return addCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to list agents" },
        { status: 500 },
      ),
    );
  }
}
