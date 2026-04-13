import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import { activityTransactionQuerySchema } from "@/lib/schemas/api-query";

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
      return NextResponse.json(
        { success: false, error: "Missing or invalid id or type" },
        { status: 400 },
      );
    }
    const { id, type: typeRaw, network } = parsedQuery.data;
    requireNetworkedOidcApiScope(authContext, {
      resource: "activity",
      action: "read",
      network,
    });

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Payment node is not configured" },
        { status: 503 },
      );
    }

    const smartContractAddress =
      await getSmartContractAddressForConfiguredSource(
        client,
        authContext.user.id,
      );
    if (!smartContractAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "No smart contract address for this payment source",
        },
        { status: 503 },
      );
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
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { type: typeRaw as "payment" | "purchase", item },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[Activity transaction] GET failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load transaction" },
      { status: 500 },
    );
  }
}
