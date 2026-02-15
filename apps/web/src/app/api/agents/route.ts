import prisma, { RegistrationState } from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

const exampleOutputSchema = z.object({
  name: z.string().max(60).min(1),
  url: z.string().url().min(1),
  mimeType: z.string().max(60).min(1),
});

const registerAgentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  summary: z
    .string()
    .max(250, "Summary must be 250 characters or less")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional()
    .or(z.literal("")),
  apiUrl: z
    .string()
    .url("API URL must be a valid URL")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "API URL must start with http:// or https://",
    }),
  tags: z.string().optional(),
  icon: z.string().max(2000).optional(),
  pricing: z
    .object({
      pricingType: z.enum(["Free", "Fixed"]),
      prices: z
        .array(
          z.object({
            amount: z.string(),
            currency: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  authorName: z.string().max(250).optional().or(z.literal("")),
  authorEmail: z.union([z.literal(""), z.string().email().max(250)]).optional(),
  organization: z.string().max(250).optional().or(z.literal("")),
  contactOther: z.string().max(250).optional().or(z.literal("")),
  termsOfUseUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  privacyPolicyUrl: z
    .union([z.literal(""), z.string().url().max(250)])
    .optional(),
  otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  capabilityName: z.string().max(250).optional().or(z.literal("")),
  capabilityVersion: z.string().max(250).optional().or(z.literal("")),
  exampleOutputs: z.array(exampleOutputSchema).optional(),
});

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
    const registrationState = searchParams.get("registrationState") as
      | "RegistrationRequested"
      | "RegistrationInitiated"
      | "RegistrationConfirmed"
      | "RegistrationFailed"
      | "DeregistrationRequested"
      | "DeregistrationInitiated"
      | "DeregistrationConfirmed"
      | "DeregistrationFailed"
      | null;
    const registrationStateIn = searchParams.get("registrationStateIn");
    const search = searchParams.get("search")?.trim() ?? undefined;
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
      registrationState?: RegistrationState | { in: RegistrationState[] };
    } = {
      userId: user.id,
    };

    if (unverified) {
      where.verificationStatus = {
        not: "VERIFIED" as const,
      };
    } else if (verificationStatus) {
      where.verificationStatus = verificationStatus as
        | "PENDING"
        | "VERIFIED"
        | "REVOKED"
        | "EXPIRED"
        | null;
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
      where.registrationState = registrationState;
    }

    const searchFilter =
      search && search.length > 0
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { summary: { contains: search, mode: "insensitive" as const } },
              {
                description: { contains: search, mode: "insensitive" as const },
              },
              { apiUrl: { contains: search, mode: "insensitive" as const } },
              { tags: { hasSome: [search] } },
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
