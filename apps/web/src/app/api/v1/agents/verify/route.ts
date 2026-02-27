import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = await checkRateLimit(`public-agent-verify:${ip}`);

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

    const agentIdentifier = request.nextUrl.searchParams.get("agentIdentifier");
    if (!agentIdentifier) {
      return addCorsHeaders(
        NextResponse.json(
          { success: false, error: "Missing agentIdentifier" },
          { status: 400 },
        ),
        request,
      );
    }

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
      const res = NextResponse.json({
        success: true,
        data: { verified: false },
      });
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      return addCorsHeaders(res, request);
    }

    const credential = await prisma.veridianCredential.findFirst({
      where: { agentId: agent.id, status: "ISSUED" },
      select: { credentialId: true, expiresAt: true },
      orderBy: { issuedAt: "desc" },
    });

    if (!credential) {
      const res = NextResponse.json({
        success: true,
        data: { verified: false },
      });
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      return addCorsHeaders(res, request);
    }

    const isExpired =
      credential.expiresAt !== null && credential.expiresAt < new Date();

    const res = NextResponse.json({
      success: true,
      data: {
        verified: !isExpired,
        credentialId: credential.credentialId,
        expiresAt: credential.expiresAt,
        agentName: agent.name,
        apiUrl: agent.apiUrl,
      },
    });
    res.headers.set("X-RateLimit-Limit", String(rl.limit));
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return addCorsHeaders(res, request);
  } catch (error) {
    console.error("Failed to verify agent:", error);
    return addCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to verify agent" },
        { status: 500 },
      ),
      request,
    );
  }
}
