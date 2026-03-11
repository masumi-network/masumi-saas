import prisma, { RegistrationState } from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildAgentPricing,
  registerAgentOnChain,
  type RegisterAgentParams,
} from "@/lib/agent-registration";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { parseNetwork } from "@/lib/schemas";
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
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

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
  const fromCookie = request.cookies.get("payment_network")?.value;
  return parseNetwork(fromQuery ?? fromCookie ?? undefined);
}

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

    if (tagsArray.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one tag is required." },
        { status: 400 },
      );
    }

    const network = getNetworkFromRequest(request);
    const agentPricing = buildAgentPricing(network, pricing ?? undefined);

    const params: RegisterAgentParams = {
      name,
      description: description?.trim() || null,
      extendedDescription: (extendedDescription?.trim() || null) as
        | string
        | null,
      apiUrl,
      tags: tagsArray,
      icon: icon?.trim() || null,
      agentPricing,
      exampleOutputs: exampleOutputs ?? [],
      capabilityName: (capabilityName?.trim() || "Masumi") as string,
      capabilityVersion: (capabilityVersion?.trim() || "1.0") as string,
      termsOfUseUrl: termsOfUseUrl?.trim() || null,
      privacyPolicyUrl: privacyPolicyUrl?.trim() || null,
      otherUrl: otherUrl?.trim() || null,
    };

    const result = await registerAgentOnChain(
      {
        user: {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
        },
        activeOrganizationId,
        network,
      },
      params,
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
      });
    }
    if (
      result.error === "WALLET_FUNDING_PENDING" &&
      "agentId" in result &&
      typeof result.agentId === "string"
    ) {
      return NextResponse.json(
        {
          success: true,
          status: "wallet_funding_pending",
          agentId: result.agentId,
          message:
            "Wallet is being funded. Poll POST /api/agents/:id/complete-registration until status is registered.",
        },
        { status: 202 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
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
