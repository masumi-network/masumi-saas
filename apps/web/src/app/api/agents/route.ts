import prisma, { RegistrationState } from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { registerAgentBodySchema } from "@/lib/schemas/agent";

const getAgentsQuerySchema = z.object({
  verificationStatus: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(["PENDING", "VERIFIED", "REVOKED", "EXPIRED"]))
    .optional(),
  unverified: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(50).optional().default(10),
  registrationState: z.string().optional(),
  registrationStateIn: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const queryValidation = getAgentsQuerySchema.safeParse(rawParams);
    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryValidation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const {
      verificationStatus,
      unverified,
      cursor,
      take,
      registrationState,
      registrationStateIn,
      search,
    } = queryValidation.data;

    const searchTrimmed = search?.trim();
    const where: {
      userId: string;
      verificationStatus?:
        | { not: "VERIFIED" }
        | "PENDING"
        | "VERIFIED"
        | "REVOKED"
        | "EXPIRED"
        | null;
      registrationState?: RegistrationState | { in: RegistrationState[] };
    } = {
      userId: user.id,
    };

    if (unverified) {
      where.verificationStatus = { not: "VERIFIED" as const };
    } else if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }

    const validStates = Object.values(RegistrationState) as string[];
    if (registrationStateIn) {
      const states = registrationStateIn
        .split(",")
        .map((s) => s.trim())
        .filter((s) => validStates.includes(s)) as RegistrationState[];
      if (states.length > 0) {
        where.registrationState = { in: states };
      }
    } else if (registrationState && validStates.includes(registrationState)) {
      where.registrationState = registrationState as RegistrationState;
    }

    const searchFilter =
      searchTrimmed && searchTrimmed.length > 0
        ? {
            OR: [
              {
                name: { contains: searchTrimmed, mode: "insensitive" as const },
              },
              {
                summary: {
                  contains: searchTrimmed,
                  mode: "insensitive" as const,
                },
              },
              {
                description: {
                  contains: searchTrimmed,
                  mode: "insensitive" as const,
                },
              },
              {
                apiUrl: {
                  contains: searchTrimmed,
                  mode: "insensitive" as const,
                },
              },
              { tags: { hasSome: [searchTrimmed] } },
            ],
          }
        : undefined;

    const finalWhere =
      searchFilter !== undefined ? { AND: [where, searchFilter] } : where;

    const agents = await prisma.agent.findMany({
      where: finalWhere,
      orderBy: {
        createdAt: "desc",
      },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

    const {
      name,
      summary,
      description,
      apiUrl,
      tags,
      icon,
      pricing,
      authorName,
      authorEmail,
      organization,
      contactOther,
      termsOfUseUrl,
      privacyPolicyUrl,
      otherUrl,
      capabilityName,
      capabilityVersion,
      exampleOutputs,
    } = validation.data;

    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    const metadata: Record<string, unknown> = {};
    if (authorName?.trim()) metadata.authorName = authorName.trim();
    if (authorEmail?.trim()) metadata.authorEmail = authorEmail.trim();
    if (organization?.trim()) metadata.organization = organization.trim();
    if (contactOther?.trim()) metadata.contactOther = contactOther.trim();
    if (termsOfUseUrl?.trim()) metadata.termsOfUseUrl = termsOfUseUrl.trim();
    if (privacyPolicyUrl?.trim())
      metadata.privacyPolicyUrl = privacyPolicyUrl.trim();
    if (otherUrl?.trim()) metadata.otherUrl = otherUrl.trim();
    if (capabilityName?.trim()) metadata.capabilityName = capabilityName.trim();
    if (capabilityVersion?.trim())
      metadata.capabilityVersion = capabilityVersion.trim();
    if (exampleOutputs?.length) metadata.exampleOutputs = exampleOutputs;

    const agent = await prisma.agent.create({
      data: {
        name,
        summary: summary?.trim() || null,
        description: (description?.trim() || null) as string | null,
        apiUrl,
        tags: tagsArray,
        icon: icon?.trim() || null,
        pricing: pricing ?? null,
        metadata:
          Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
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
