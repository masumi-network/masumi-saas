import prisma, { RegistrationState } from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
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
  network: z.enum(["Mainnet", "Preprod"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);

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

    const network = getNetworkFromRequest(request);

    const searchTrimmed = search?.trim();

    const verificationFilter = unverified
      ? { verificationStatus: { not: "VERIFIED" as const } }
      : verificationStatus
        ? { verificationStatus }
        : {};

    const validStates = Object.values(RegistrationState) as string[];
    const registrationFilter = (() => {
      if (registrationStateIn) {
        const states = registrationStateIn
          .split(",")
          .map((s) => s.trim())
          .filter((s) => validStates.includes(s)) as RegistrationState[];
        if (states.length > 0) return { registrationState: { in: states } };
      }
      if (registrationState && validStates.includes(registrationState)) {
        return { registrationState: registrationState as RegistrationState };
      }
      return {};
    })();

    const searchFilter =
      searchTrimmed && searchTrimmed.length > 0
        ? {
            OR: [
              {
                name: { contains: searchTrimmed, mode: "insensitive" as const },
              },
              {
                description: {
                  contains: searchTrimmed,
                  mode: "insensitive" as const,
                },
              },
              {
                extendedDescription: {
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

    const baseWhere = {
      userId: user.id,
      ...verificationFilter,
      ...registrationFilter,
      networkIdentifier: network,
    };

    const finalWhere =
      searchFilter !== undefined
        ? { AND: [baseWhere, searchFilter] }
        : baseWhere;

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
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get agents" },
      { status: 500 },
    );
  }
}

function getNetworkFromRequest(request: NextRequest): "Mainnet" | "Preprod" {
  const fromQuery = request.nextUrl.searchParams.get("network");
  if (fromQuery === "Mainnet" || fromQuery === "Preprod") return fromQuery;
  const fromCookie = request.cookies.get("payment_network")?.value;
  if (fromCookie === "Mainnet" || fromCookie === "Preprod") return fromCookie;
  return "Preprod";
}

// Creates the agent in DB only. State is RegistrationRequested until on-chain
// registration is completed (e.g. via UI flow or completeRegistrationIfReadyAction).
// Do not set RegistrationConfirmed here — that must come from the payment node/chain.
export async function POST(request: NextRequest) {
  try {
    const { user, activeOrganizationId } =
      await getAuthenticatedOrThrow(request);

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
      description,
      extendedDescription,
      apiUrl,
      tags,
      icon,
      pricing,
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
    if (user.name?.trim()) metadata.authorName = user.name.trim();
    if (user.email?.trim()) metadata.authorEmail = user.email.trim();
    if (termsOfUseUrl?.trim()) metadata.termsOfUseUrl = termsOfUseUrl.trim();
    if (privacyPolicyUrl?.trim())
      metadata.privacyPolicyUrl = privacyPolicyUrl.trim();
    if (otherUrl?.trim()) metadata.otherUrl = otherUrl.trim();
    if (capabilityName?.trim()) metadata.capabilityName = capabilityName.trim();
    if (capabilityVersion?.trim())
      metadata.capabilityVersion = capabilityVersion.trim();
    if (exampleOutputs?.length) metadata.exampleOutputs = exampleOutputs;

    const network = getNetworkFromRequest(request);

    const agent = await prisma.agent.create({
      data: {
        name,
        description: description?.trim() || null,
        extendedDescription: (extendedDescription?.trim() || null) as
          | string
          | null,
        apiUrl,
        tags: tagsArray,
        icon: icon?.trim() || null,
        pricing: pricing ?? null,
        metadata:
          Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        userId: user.id,
        organizationId: activeOrganizationId,
        registrationState: "RegistrationRequested",
        networkIdentifier: network,
      },
    });

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to register agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register agent" },
      { status: 500 },
    );
  }
}
