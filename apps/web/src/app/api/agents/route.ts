import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";

const registerAgentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters"),
  apiUrl: z
    .string()
    .url("API URL must be a valid URL")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "API URL must start with http:// or https://",
    }),
  tags: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const searchParams = request.nextUrl.searchParams;
    const verificationStatus = searchParams.get("verificationStatus") as
      | "APPROVED"
      | "PENDING"
      | "REJECTED"
      | "REVIEW"
      | null;
    const unverified = searchParams.get("unverified") === "true";

    const where: {
      userId: string;
      verificationStatus?:
        | {
            not?: "APPROVED";
            equals?: "APPROVED" | "PENDING" | "REJECTED" | "REVIEW" | null;
          }
        | "APPROVED"
        | "PENDING"
        | "REJECTED"
        | "REVIEW"
        | null;
    } = {
      userId: user.id,
    };

    if (unverified) {
      where.verificationStatus = {
        not: "APPROVED",
      };
    } else if (verificationStatus !== null) {
      where.verificationStatus = verificationStatus;
    }

    const agents = await prisma.agent.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    console.error("Failed to get agents:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get agents",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const body = await request.json();
    const validation = registerAgentSchema.safeParse(body);
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
        registrationState: "RegistrationConfirmed",
      },
    });

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Failed to register agent:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to register agent",
      },
      { status: 500 },
    );
  }
}
