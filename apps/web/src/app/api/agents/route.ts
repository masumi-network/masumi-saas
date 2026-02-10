import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { registerAgentBodySchema } from "@/lib/schemas/agent";

const querySchema = z.object({
  verificationStatus: z
    .enum(["APPROVED", "PENDING", "REJECTED", "REVIEW"])
    .optional(),
  unverified: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const queryValidation = querySchema.safeParse(rawParams);
    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryValidation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const { verificationStatus, unverified } = queryValidation.data;

    const where: {
      userId: string;
      verificationStatus?:
        | { not?: "APPROVED" }
        | "APPROVED"
        | "PENDING"
        | "REJECTED"
        | "REVIEW";
    } = {
      userId: user.id,
    };

    if (unverified === "true") {
      where.verificationStatus = { not: "APPROVED" };
    } else if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }

    const agents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    console.error("Failed to get agents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get agents" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const body = await request.json();
    const validation = registerAgentBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const { name, description, apiUrl, tags } = validation.data;

    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    const agent = await prisma.agent.create({
      data: {
        name,
        description,
        apiUrl,
        tags: tagsArray,
        userId: user.id,
        verificationStatus: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Failed to register agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register agent" },
      { status: 500 },
    );
  }
}
