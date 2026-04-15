import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { publicAgentSelect } from "@/lib/schemas/agent";

import contract from "./route.contract";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimitOrRespond(
      request,
      "public-agent",
    );
    if ("response" in rateLimitResult) return rateLimitResult.response;
    const { rl } = rateLimitResult;

    // Get agentId from params (must await in Next.js 16)
    const { agentId } = await params;

    // 3. Query DB — no userId filter (public lookup)
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: publicAgentSelect,
    });

    // 4. 404 if not found
    if (!agent) {
      return addCorsHeaders(
        contractJsonResponse(contract, "GET", 404, {
          success: false,
          error: "Agent not found",
        }),
        request,
      );
    }

    // 5. Return response
    const res = contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: agent,
    });
    res.headers.set("X-RateLimit-Limit", String(rl.limit));
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return addCorsHeaders(res, request);
  } catch (error) {
    console.error("Failed to get agent:", error);
    return addCorsHeaders(
      contractJsonResponse(contract, "GET", 500, {
        success: false,
        error: "Failed to get agent",
      }),
      request,
    );
  }
}
