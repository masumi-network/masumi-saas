import prisma, { RegistrationState } from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import {
  buildAgentPricing,
  type RegisterAgentParams,
  startAgentRegistration,
} from "@/lib/agent-registration";
import { listWalletOwnedAgentsForUser } from "@/lib/agents/wallet-ownership";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
} from "@/lib/credits/service";
import { parseNetwork } from "@/lib/schemas";
import {
  agentsListQuerySchema,
  registerAgentBodySchema,
} from "@/lib/schemas/agent";

function matchesAgentSearch(
  agent: {
    name: string;
    description: string | null;
    extendedDescription: string | null;
    apiUrl: string;
    tags: string[];
  },
  search?: string,
): boolean {
  const query = search?.trim().toLowerCase();
  if (!query) return true;

  return (
    agent.name.toLowerCase().includes(query) ||
    agent.description?.toLowerCase().includes(query) === true ||
    agent.extendedDescription?.toLowerCase().includes(query) === true ||
    agent.apiUrl.toLowerCase().includes(query) ||
    agent.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}

function matchesVerificationFilter(
  agent: { verificationStatus: string | null },
  options: {
    verificationStatus?: string | null;
    unverified?: boolean;
  },
): boolean {
  if (options.unverified) {
    return agent.verificationStatus !== "VERIFIED";
  }
  if (options.verificationStatus) {
    return agent.verificationStatus === options.verificationStatus;
  }
  return true;
}

function matchesRegistrationFilter(
  agent: { registrationState: string },
  options: {
    registrationState?: string;
    registrationStateIn?: string | null;
  },
): boolean {
  if (options.registrationStateIn) {
    const states = options.registrationStateIn
      .split(",")
      .map((state) => state.trim())
      .filter(Boolean);
    if (states.length > 0) {
      return states.includes(agent.registrationState);
    }
  }
  if (options.registrationState) {
    return agent.registrationState === options.registrationState;
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const queryValidation = agentsListQuerySchema.safeParse(rawParams);
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
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network,
    });

    const validStates = new Set(Object.values(RegistrationState) as string[]);
    const normalizedRegistrationStateIn = registrationStateIn
      ? registrationStateIn
          .split(",")
          .map((state) => state.trim())
          .filter((state) => validStates.has(state))
          .join(",")
      : null;
    const normalizedRegistrationState =
      registrationState && validStates.has(registrationState)
        ? registrationState
        : undefined;

    const walletOwnedAgents = await listWalletOwnedAgentsForUser({
      userId: authContext.user.id,
      network,
    });

    const filteredAgents = walletOwnedAgents.filter(
      (agent) =>
        matchesVerificationFilter(agent, {
          verificationStatus,
          unverified,
        }) &&
        matchesRegistrationFilter(agent, {
          registrationState: normalizedRegistrationState,
          registrationStateIn: normalizedRegistrationStateIn,
        }) &&
        matchesAgentSearch(agent, search),
    );

    const startIndex = cursor
      ? filteredAgents.findIndex((agent) => agent.id === cursor) + 1
      : 0;
    const safeStartIndex = startIndex > 0 ? startIndex : 0;
    const page = filteredAgents.slice(safeStartIndex, safeStartIndex + take);
    const hasMore = safeStartIndex + take < filteredAgents.length;
    const nextCursor =
      hasMore && page.length > 0 ? (page[page.length - 1]?.id ?? null) : null;

    return NextResponse.json({
      success: true,
      data: page.map(({ agentReference: _agentReference, ...agent }) => agent),
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
    const authContext = await getAuthenticatedOrThrow(request);
    const { user, activeOrganizationId } = authContext;

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
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "write",
      network,
    });
    const agentPricing = buildAgentPricing(network, pricing ?? undefined);

    await consumeCreditIfRequired({
      userId: user.id,
      reason: "agent_register",
      reference: createCreditReference("agent-register"),
      network,
      metadata: {
        name,
        apiUrl,
        network,
        authMethod: authContext.authMethod,
      },
    });

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

    const result = await startAgentRegistration(
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
      const agent = await prisma.agent.findFirst({
        where: { id: result.agentId, userId: user.id },
        include: { agentReference: true },
      });
      if (!agent) {
        return NextResponse.json(
          { success: false, error: "Failed to load created agent" },
          { status: 500 },
        );
      }
      const data = shapeAgentWithMergedMetadata(agent);
      return NextResponse.json(
        { success: true, data, agentId: result.agentId },
        { status: 200 },
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
