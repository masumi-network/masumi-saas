import prisma from "@masumi/database/client";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api/error";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

const bodySchema = z.object({
  regenerate: z.boolean().optional().default(false),
});

/**
 * GET or POST /api/agents/[agentId]/verification-challenge
 * Returns the current verification challenge for the agent, or generates a new one.
 * POST with { regenerate: true } to generate a new challenge (invalidates the previous).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return handleChallengeRequest(params, false);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const regenerate = parsed.success ? parsed.data.regenerate : false;
  return handleChallengeRequest(params, regenerate);
}

async function handleChallengeRequest(
  params: Promise<{ agentId: string }>,
  regenerate: boolean,
) {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return apiError("Agent not found", 404);
    }

    if (agent.registrationState !== "RegistrationConfirmed") {
      return apiError(
        `Agent must be registered. Current state: ${agent.registrationState}`,
        400,
      );
    }

    let challenge = agent.verificationChallenge;
    let generatedAt = agent.verificationChallengeGeneratedAt;

    if (regenerate || !challenge) {
      challenge = randomUUID();
      const updated = await prisma.agent.update({
        where: { id: agentId },
        data: {
          verificationChallenge: challenge,
          verificationChallengeGeneratedAt: new Date(),
        },
      });
      generatedAt = updated.verificationChallengeGeneratedAt;
    }

    return NextResponse.json({
      success: true,
      data: {
        challenge,
        generatedAt: generatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to get verification challenge:", error);
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to get verification challenge",
      500,
    );
  }
}
