import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { agentPaginationSchema, publicAgentSelect } from "@/lib/schemas/agent";

// Agent verification uses PENDING | VERIFIED | REVOKED | EXPIRED (not KYC-style APPROVED).
// Verified agents have always been set to VERIFIED in this product; no migration from APPROVED.
const querySchema = z.object({
  status: z
    .enum(["PENDING", "VERIFIED", "REVOKED", "EXPIRED"])
    .optional()
    .default("VERIFIED"),
});

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimitOrRespond(
      request,
      "public-agents",
    );
    if ("response" in rateLimitResult) return rateLimitResult.response;
    const { rl } = rateLimitResult;

    // Validate query params
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
        request,
      );
    }

    const { status } = validation.data;

    const paginationValidation = agentPaginationSchema.safeParse(params);
    const { page, limit } = paginationValidation.success
      ? paginationValidation.data
      : { page: 1, limit: 50 };

    const where = {
      verificationStatus: status,
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
    return addCorsHeaders(res, request);
  } catch (error) {
    console.error("Failed to list agents:", error);
    return addCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to list agents" },
        { status: 500 },
      ),
      request,
    );
  }
}
