import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { publicAgentSelect } from "@/lib/schemas/agent";

import contract, { publicAgentsQuerySchema } from "./route.contract";

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
    const validation = publicAgentsQuerySchema.safeParse(params);
    if (!validation.success) {
      return addCorsHeaders(
        contractJsonResponse(contract, "GET", 400, {
          success: false,
          error: validation.error.issues.map((e) => e.message).join(", "),
        }),
        request,
      );
    }

    const { status, page, limit } = validation.data;

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
    const res = contractJsonResponse(contract, "GET", 200, {
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
      contractJsonResponse(contract, "GET", 500, {
        success: false,
        error: "Failed to list agents",
      }),
      request,
    );
  }
}
