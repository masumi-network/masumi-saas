import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { registerAgentBodySchema } from "@/lib/schemas/agent";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const searchParams = request.nextUrl.searchParams;
    const verificationStatus = searchParams.get("verificationStatus") as
      | "PENDING"
      | "VERIFIED"
      | "REVOKED"
      | "EXPIRED"
      | null;
    const unverified = searchParams.get("unverified") === "true";
    const cursorId = searchParams.get("cursor") ?? undefined;
    const take = Math.min(
      Math.max(1, parseInt(searchParams.get("take") ?? "10", 10) || 10),
      50,
    );

    const where: {
      userId: string;
      verificationStatus?:
        | { not: "VERIFIED" }
        | "PENDING"
        | "VERIFIED"
        | "REVOKED"
        | "EXPIRED"
        | null;
    } = {
      userId: user.id,
    };

    if (unverified) {
      where.verificationStatus = {
        not: "VERIFIED" as const,
      };
    } else if (verificationStatus !== null) {
      where.verificationStatus = verificationStatus as
        | "PENDING"
        | "VERIFIED"
        | "REVOKED"
        | "EXPIRED"
        | null;
    }

    const agents = await prisma.agent.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: take + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const hasMore = agents.length > take;
    const page = hasMore ? agents.slice(0, take) : agents;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

    return NextResponse.json({
      success: true,
      data: page,
      nextCursor,
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

// TODO: Replace with on-chain registration + signed data; this flow currently
// creates the agent in DB and sets registrationState to RegistrationConfirmed
// without on-chain lookup or verification.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow();

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
