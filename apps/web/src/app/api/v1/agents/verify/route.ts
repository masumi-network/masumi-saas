import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { agentVerifyQuerySchema } from "@/lib/schemas";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimitOrRespond(
      request,
      "public-agent-verify",
    );
    if ("response" in rateLimitResult) return rateLimitResult.response;
    const { rl } = rateLimitResult;

    const queryResult = agentVerifyQuerySchema.safeParse({
      agentIdentifier: request.nextUrl.searchParams.get("agentIdentifier"),
    });
    if (!queryResult.success) {
      return addCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error:
              queryResult.error.issues.map((i) => i.message).join("; ") ||
              "Invalid query",
          },
          { status: 400 },
        ),
        request,
      );
    }
    const { agentIdentifier } = queryResult.data;

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
