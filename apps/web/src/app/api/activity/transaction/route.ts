import { createRoute } from "@hono/zod-openapi";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import { activityTransactionQuerySchema } from "@/lib/schemas/api-query";
import {
  activityTransactionSuccessSchema,
  errBody,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/activity/transaction");

/**
 * GET /api/activity/transaction?id=&type=payment|purchase&network=
 * Loads a single payment or purchase via the payment-node list API + searchQuery (exact id match).
 */
app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Activity"],
    summary: "Get activity transaction",
    description:
      "Loads a single payment or purchase visible to the caller by ID and transaction type.",
    security,
    request: {
      query: activityTransactionQuerySchema,
    },
    responses: {
      200: {
        description: "Transaction detail",
        content: {
          "application/json": { schema: activityTransactionSuccessSchema },
        },
      },
      503: {
        description:
          "Payment node is not configured or the active payment source is unavailable for the requested network.",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const { id, type: typeRaw, network } = c.req.valid("query");
    requireNetworkedOidcApiScope(authContext, {
      resource: "activity",
      action: "read",
      network,
    });

    try {
      const client = await getPaymentNodeClientForUser(authContext.user.id);
      if (!client) {
        throw new ApiError(503, "Payment node is not configured");
      }

      const smartContractAddress =
        await getSmartContractAddressForConfiguredSource(
          client,
          authContext.user.id,
          network,
        );
      if (!smartContractAddress) {
        throw new ApiError(
          503,
          "No smart contract address for this payment source",
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
        throw new ApiError(404, "Transaction not found");
      }

      return c.json(
        {
          success: true as const,
          data: { type: typeRaw as "payment" | "purchase", item },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      console.error("[Activity transaction] GET failed:", error);
      throw new ApiError(500, "Failed to load transaction");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
