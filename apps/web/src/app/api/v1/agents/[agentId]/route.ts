import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { publicAgentSelect } from "@/lib/schemas/agent";

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
        NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 },
        ),
        request,
      );
    }

    // 5. Return response
    const res = NextResponse.json({ success: true, data: agent });
    res.headers.set("X-RateLimit-Limit", String(rl.limit));
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return addCorsHeaders(res, request);
  } catch (error) {
    console.error("Failed to get agent:", error);
    return addCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to get agent" },
        { status: 500 },
      ),
      request,
    );
  }
}
