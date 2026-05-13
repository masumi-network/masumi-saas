import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import { activityTransactionQuerySchema } from "@/lib/schemas/api-query";

import contract from "./route.contract";

/**
 * GET /api/activity/transaction?id=&type=payment|purchase&network=
 * Loads a single payment or purchase via the payment-node list API + searchQuery (exact id match).
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsedQuery = activityTransactionQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      return contractJsonResponse(contract, "GET", 400, {
        success: false,
        error: "Missing or invalid id or type",
      });
    }
    const { id, type: typeRaw, network } = parsedQuery.data;
    requireNetworkedOidcApiScope(authContext, {
      resource: "activity",
      action: "read",
      network,
    });

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "GET", 503, {
        success: false,
        error: "Payment node is not configured",
      });
    }

    const smartContractAddress =
      await getSmartContractAddressForConfiguredSource(
        client,
        authContext.user.id,
        network,
      );
    if (!smartContractAddress) {
      return contractJsonResponse(contract, "GET", 503, {
        success: false,
        error: "No smart contract address for this payment source",
      });
    }

    const listParams = {
      network,
      filterSmartContractAddress: smartContractAddress,
      limit: 40,
      searchQuery: id,
    };

    let item: PaymentOrPurchaseItem | undefined;
    if (typeRaw === "payment") {
      const res = await client.listPayments(listParams);
      item = (res.Payments ?? []).find((p) => String(p.id) === id);
    } else {
      const res = await client.listPurchases(listParams);
      item = (res.Purchases ?? []).find((p) => String(p.id) === id);
    }

    if (!item) {
      return contractJsonResponse(contract, "GET", 404, {
        success: false,
        error: "Transaction not found",
      });
    }

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: { type: typeRaw as "payment" | "purchase", item },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    if (isPaymentNodeConfigError(error)) {
      return contractJsonResponse(contract, "GET", 503, {
        success: false,
        error: error.message,
      });
    }
    console.error("[Activity transaction] GET failed:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load transaction",
    });
  }
}
