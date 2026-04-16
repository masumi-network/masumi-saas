import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
} from "@/lib/credits/service";
import { prepareManagedInboxRegistration } from "@/lib/inbox-agents/server";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { ensureUserPaymentNodeKeyScopedToWallets } from "@/lib/payment-node/wallet-scopes";
import {
  getCanonicalInboxAgentSlug,
  inboxAgentsListQuerySchema,
  registerInboxAgentBodySchema,
  validateCanonicalInboxAgentSlug,
} from "@/lib/schemas/inbox-agent";

import contract from "../../../pay/api/v1/inbox-agents/route.contract";

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
      return contractJsonResponse(contract, "GET", 400, {
        success: false,
        error: queryValidation.error.issues
          .map((issue) => issue.message)
          .join(", "),
      });
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
      return contractJsonResponse(contract, "GET", 403, {
        success: false,
        error: "Payment node not configured for user",
      });
    }

    const { Assets } = await client.getRegistryInbox({
      network,
      limit: take,
      cursorId: cursor,
      filterStatus,
      searchQuery: search || undefined,
    });

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: Assets,
      nextCursor: Assets.length === take ? (Assets.at(-1)?.id ?? null) : null,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get inbox agents:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to get inbox agents",
    });
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
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: validation.error.issues.map((issue) => issue.message).join(", "),
      });
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "POST", 403, {
        success: false,
        error: "Payment node not configured for user",
      });
    }

    const canonicalSlug = getCanonicalInboxAgentSlug(validation.data.agentSlug);
    const slugValidationError = validateCanonicalInboxAgentSlug(canonicalSlug);
    if (slugValidationError) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: slugValidationError,
      });
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
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: managedRegistration.error,
      });
    }

    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: authContext.user.id,
      walletIds: [
        managedRegistration.sellingWalletId,
        managedRegistration.fundingWallet.id,
      ],
    });

    const created = await client.registerInboxAgent({
      network,
      sellingWalletVkey: managedRegistration.fundingWallet.walletVkey,
      recipientWalletAddress: managedRegistration.sellingWallet.walletAddress,
      name: validation.data.name.trim(),
      description: validation.data.description?.trim() || undefined,
      agentSlug: canonicalSlug,
    });

    return contractJsonResponse(contract, "POST", 200, {
      success: true,
      data: created,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    if (isPaymentNodeConfigError(error)) {
      return contractJsonResponse(contract, "POST", 503, {
        success: false,
        error: error.message,
      });
    }
    console.error("Failed to register inbox agent:", error);
    return contractJsonResponse(contract, "POST", 500, {
      success: false,
      error: "Failed to register inbox agent",
    });
  }
}
