import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedHeaders();
    const { agentId } = await params;

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

    const updatedAgent = await prisma.agent.update({
      where: {
        id: agentId,
      },
      data: {
        verificationStatus: "REVIEW",
        // veridianCredentialId: credentialId, // Uncomment when API is integrated
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
