import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
  refundConsumedCredit,
} from "@/lib/credits/service";
import {
  createInboxAdminPaymentNodeClient,
  isInboxAgentOwnershipMismatchError,
  isStaleInboxAgentCursorError,
  listOwnedInboxAgentsForUser,
  prepareManagedInboxRegistration,
  saveInboxAgentReference,
} from "@/lib/inbox-agents/server";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import type {
  PaymentNodeClient,
  PaymentSourceWallet,
  RegistryInboxEntry,
} from "@/lib/payment-node";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import {
  getCanonicalInboxAgentSlug,
  inboxAgentsListQuerySchema,
  registerInboxAgentBodySchema,
  validateCanonicalInboxAgentSlug,
} from "@/lib/schemas/inbox-agent";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";

import contract from "../../../pay/api/v1/inbox-agents/route.contract";

const INBOX_REFERENCE_SAVE_ATTEMPTS = 2;

type ExecutingWalletIdentity = Pick<
  PaymentSourceWallet,
  "id" | "walletVkey" | "walletAddress"
>;

type PersistResult =
  | { status: "success" }
  | { status: "ownership-mismatch" }
  | { status: "error" };

async function persistCreatedInboxAgentReference(params: {
  client: PaymentNodeClient;
  userId: string;
  network: PaymentNodeNetwork;
  entry: RegistryInboxEntry;
  executingWallet: ExecutingWalletIdentity;
  smartContractAddress: string;
}): Promise<PersistResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt < INBOX_REFERENCE_SAVE_ATTEMPTS; attempt += 1) {
    try {
      await saveInboxAgentReference({
        userId: params.userId,
        network: params.network,
        entry: params.entry,
        executingWallet: params.executingWallet,
        smartContractAddress: params.smartContractAddress,
      });
      return { status: "success" };
    } catch (error) {
      if (isInboxAgentOwnershipMismatchError(error)) {
        console.error(
          "[Inbox Agents] Registered inbox collides with another user's ownership record; leaving remote entry intact:",
          {
            inboxAgentId: params.entry.id,
            attemptedUserId: params.userId,
            ownedByUserId: error.ownedByUserId,
          },
        );
        return { status: "ownership-mismatch" };
      }
      lastError = error;
    }
  }

  console.error("[Inbox Agents] Failed to persist created ownership record:", {
    inboxAgentId: params.entry.id,
    userId: params.userId,
    error: lastError,
  });

  try {
    await params.client.deleteRegistryInboxEntry(params.entry.id);
  } catch (cleanupError) {
    console.error(
      "[Inbox Agents] Failed to clean up inbox registration after ownership persistence failed:",
      {
        inboxAgentId: params.entry.id,
        userId: params.userId,
        error: cleanupError,
      },
    );
  }

  return { status: "error" };
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

    const { Assets, nextCursor } = await listOwnedInboxAgentsForUser({
      userId: authContext.user.id,
      network,
      take,
      cursor,
      filterStatus,
      search,
    });

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: Assets,
      nextCursor,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    if (isStaleInboxAgentCursorError(error)) {
      return contractJsonResponse(contract, "GET", 410, {
        success: false,
        error: error.message,
      });
    }
    console.error("Failed to get inbox agents:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to get inbox agents",
    });
  }
}

export async function POST(request: NextRequest) {
  let creditRefund: (() => Promise<void>) | null = null;

  try {
    const authContext = await getAuthenticatedOrThrow(request);
    const network = getEffectivePaymentNetwork(request);
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

    const canonicalSlug = getCanonicalInboxAgentSlug(validation.data.agentSlug);
    const slugValidationError = validateCanonicalInboxAgentSlug(canonicalSlug);
    if (slugValidationError) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: slugValidationError,
      });
    }

    const userPaymentNodeClient = await getPaymentNodeClientForUser(
      authContext.user.id,
    );
    if (!userPaymentNodeClient) {
      return contractJsonResponse(contract, "POST", 403, {
        success: false,
        error: "Payment node not configured for user",
      });
    }

    const creditReference = createCreditReference("inbox-agent-register");
    const creditMetadata = {
      name: validation.data.name.trim(),
      agentSlug: canonicalSlug,
      network,
      authMethod: authContext.authMethod,
    };
    await consumeCreditIfRequired({
      userId: authContext.user.id,
      reason: "inbox_agent_register",
      reference: creditReference,
      network,
      metadata: creditMetadata,
    });
    creditRefund = () =>
      refundConsumedCredit({
        userId: authContext.user.id,
        reason: "inbox_agent_register",
        reference: creditReference,
        network,
        metadata: creditMetadata,
      });

    const managedRegistration = await prepareManagedInboxRegistration({
      name: validation.data.name.trim(),
      network,
    });
    if (!managedRegistration.success) {
      await creditRefund();
      creditRefund = null;
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: managedRegistration.error,
      });
    }
    const client = createInboxAdminPaymentNodeClient();

    const created = await client.registerInboxAgent({
      network,
      sellingWalletVkey: managedRegistration.executingWallet.walletVkey,
      recipientWalletAddress: managedRegistration.executingWallet.walletAddress,
      name: validation.data.name.trim(),
      description: validation.data.description?.trim() || undefined,
      agentSlug: canonicalSlug,
    });

    const persistResult = await persistCreatedInboxAgentReference({
      client,
      userId: authContext.user.id,
      network,
      entry: created,
      executingWallet: managedRegistration.executingWallet,
      smartContractAddress: managedRegistration.smartContractAddress,
    });
    if (persistResult.status === "ownership-mismatch") {
      await creditRefund();
      creditRefund = null;
      return contractJsonResponse(contract, "POST", 409, {
        success: false,
        error: "Inbox agent is already registered to another account",
      });
    }
    if (persistResult.status === "error") {
      await creditRefund();
      creditRefund = null;
      return contractJsonResponse(contract, "POST", 500, {
        success: false,
        error: "Failed to persist inbox agent ownership",
      });
    }

    creditRefund = null;
    return contractJsonResponse(contract, "POST", 200, {
      success: true,
      data: created,
    });
  } catch (error) {
    if (creditRefund) {
      await creditRefund();
    }
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
