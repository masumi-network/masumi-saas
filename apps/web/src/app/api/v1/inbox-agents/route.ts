import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
} from "@/lib/credits/service";
import { prepareManagedInboxRegistration } from "@/lib/inbox-agents/server";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import {
  getCanonicalInboxAgentSlug,
  inboxAgentsListQuerySchema,
  registerInboxAgentBodySchema,
  validateCanonicalInboxAgentSlug,
} from "@/lib/schemas/inbox-agent";

function getNetworkFromRequest(request: NextRequest): "Mainnet" | "Preprod" {
  const fromQuery = request.nextUrl.searchParams.get("network");
  const fromCookie = request.cookies.get("payment_network")?.value;
  return fromQuery === "Mainnet" || fromQuery === "Preprod"
    ? fromQuery
    : fromCookie === "Mainnet" || fromCookie === "Preprod"
      ? fromCookie
      : "Preprod";
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );

    const queryValidation = inboxAgentsListQuerySchema.safeParse({
      ...rawParams,
      network:
        rawParams.network ?? request.cookies.get("payment_network")?.value,
    });
    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryValidation.error.issues
            .map((issue) => issue.message)
            .join(", "),
        },
        { status: 400 },
      );
    }

    const { cursor, filterStatus, network, search, take } =
      queryValidation.data;
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
      action: "read",
      network,
    });

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Payment node not configured for user" },
        { status: 403 },
      );
    }

    const { Assets } = await client.getRegistryInbox({
      network,
      limit: take,
      cursorId: cursor,
      filterStatus,
      searchQuery: search || undefined,
    });

    return NextResponse.json({
      success: true,
      data: Assets,
      nextCursor: Assets.length === take ? (Assets.at(-1)?.id ?? null) : null,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get inbox agents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get inbox agents" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request);
    const network = getNetworkFromRequest(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
      action: "write",
      network,
    });

    const body = await request.json();
    const validation = registerInboxAgentBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues
            .map((issue) => issue.message)
            .join(", "),
        },
        { status: 400 },
      );
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Payment node not configured for user" },
        { status: 403 },
      );
    }

    const canonicalSlug = getCanonicalInboxAgentSlug(validation.data.agentSlug);
    const slugValidationError = validateCanonicalInboxAgentSlug(canonicalSlug);
    if (slugValidationError) {
      return NextResponse.json(
        { success: false, error: slugValidationError },
        { status: 400 },
      );
    }

    await consumeCreditIfRequired({
      userId: authContext.user.id,
      reason: "inbox_agent_register",
      reference: createCreditReference("inbox-agent-register"),
      network,
      metadata: {
        name: validation.data.name.trim(),
        agentSlug: canonicalSlug,
        network,
        authMethod: authContext.authMethod,
      },
    });

    const managedRegistration = await prepareManagedInboxRegistration({
      name: validation.data.name.trim(),
      network,
    });
    if (!managedRegistration.success) {
      return NextResponse.json(
        {
          success: false,
          error: managedRegistration.error,
        },
        { status: 400 },
      );
    }

    const created = await client.registerInboxAgent({
      network,
      sellingWalletVkey: managedRegistration.fundingWallet.walletVkey,
      recipientWalletAddress: managedRegistration.sellingWallet.walletAddress,
      name: validation.data.name.trim(),
      description: validation.data.description?.trim() || undefined,
      agentSlug: canonicalSlug,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to register inbox agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register inbox agent" },
      { status: 500 },
    );
  }
}
