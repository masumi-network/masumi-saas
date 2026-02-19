import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { publicAgentSelect } from "@/lib/schemas/agent";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    // 1. Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = await checkRateLimit(`public-agent:${ip}`);

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
      return addCorsHeaders(res, request);
    }

    // 2. Get agentId from params (must await in Next.js 16)
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
