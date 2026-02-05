import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import {
  fetchContactCredentials,
  findCredentialBySchema,
  getAgentVerificationSchemaSaid,
  validateCredential,
} from "@/lib/veridian";

const verifyAgentSchema = z.object({
  aid: z.string().min(1, "AID is required"),
  schemaSaid: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedHeaders();
    const { agentId } = await params;

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validation = verifyAgentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: validation.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const { aid, schemaSaid } = validation.data;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent not found",
        },
        { status: 404 },
      );
    }

    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc?.kycVerification) {
      return NextResponse.json(
        {
          success: false,
          error:
            "KYC verification not found. Please complete KYC verification first.",
        },
        { status: 400 },
      );
    }

    if (userWithKyc.kycVerification.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          error: `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
        },
        { status: 400 },
      );
    }

    let credentialId: string | null = null;
    try {
      const credentials = await fetchContactCredentials(aid);

      if (credentials.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No credentials found for this identifier. Please ensure you have credentials issued to this AID.",
          },
          { status: 400 },
        );
      }

      const expectedSchemaSaid = schemaSaid || getAgentVerificationSchemaSaid();

      const selectedCredential = findCredentialBySchema(
        credentials,
        expectedSchemaSaid,
      );

      if (!selectedCredential) {
        return NextResponse.json(
          {
            success: false,
            error: `Required credential with schema SAID '${expectedSchemaSaid}' not found. Please ensure you have the correct credential issued to this identifier.`,
          },
          { status: 400 },
        );
      }

      const validationResult = validateCredential(selectedCredential);

      if (!validationResult.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: `Credential validation failed: ${validationResult.message}`,
            details: validationResult.details,
          },
          { status: 400 },
        );
      }

      credentialId = validationResult.details?.schemaSaid || null;
    } catch (error) {
      console.error("Failed to fetch/validate credentials:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? `Failed to validate credentials: ${error.message}`
              : "Failed to validate credentials",
        },
        { status: 500 },
      );
    }

    const updatedAgent = await prisma.agent.update({
      where: {
        id: agentId,
      },
      data: {
        verificationStatus: "REVIEW",
        veridianCredentialId: credentialId,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAgent,
    });
  } catch (error) {
    console.error("Failed to request agent verification:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to request agent verification",
      },
      { status: 500 },
    );
  }
}
