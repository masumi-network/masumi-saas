import { createRoute } from "@hono/zod-openapi";
import {
  createX402Payment,
  settleX402Payment,
  verifyX402Payment,
} from "@masumi/payment-source-x402";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import {
  requireX402ApiKeyIdForPay,
  resolveX402ApiKeyId,
} from "@/lib/x402/resolve-api-key";
import {
  getCaip2NetworkLimitFromAuth,
  requireX402PayAccess,
} from "@/lib/x402/route-support";
import {
  createPaymentSchemaInput,
  createPaymentSchemaOutput,
  settleSchemaOutput,
  verifySchemaOutput,
  verifySettleSchemaInput,
} from "@/lib/x402/schemas";
import { proxyCreateX402PaymentIfCustodied } from "@/lib/x402/wallet-custody-ops";
import { triggerX402Payment } from "@/lib/x402/webhook-events";

import {
  settleX402PaymentOnNode,
  verifyX402PaymentOnNode,
} from "./inbound-custody";
import { handleRouteError, type X402App, x402Scope } from "./route-context";

type VerifyPaymentPayload = Parameters<
  typeof verifyX402Payment
>[0]["paymentPayload"];
type OutboundPaymentRequired = Parameters<
  typeof createX402Payment
>[0]["paymentRequired"];

export function registerX402PaymentsRoutes(app: X402App): void {
  app.openapi(
    createRoute({
      method: "post",
      path: "/verify",
      tags: ["x402"],
      summary: "Verify inbound x402 payment",
      description:
        "Verify a buyer's signed payment payload against a registered supported payment source. Does not move funds.",
      security,
      request: {
        body: {
          content: { "application/json": { schema: verifySettleSchemaInput } },
        },
      },
      responses: {
        200: {
          description: "Verification result",
          content: { "application/json": { schema: verifySchemaOutput } },
        },
        ...stdResponses,
      },
    }),
    async (c) => {
      try {
        const authContext = await getAuthenticatedOrThrow(c.req.raw, {
          requireEmailVerified: false,
        });
        await requireX402PayAccess(authContext);
        const input = c.req.valid("json");

        const result = await verifyX402Payment({
          verifyOnPaymentNode: verifyX402PaymentOnNode,
          userId: authContext.user.id,
          organizationId: authContext.activeOrganizationId,
          apiKeyId: await resolveX402ApiKeyId(authContext, input.apiKeyId),
          caip2NetworkLimit: getCaip2NetworkLimitFromAuth(authContext, "write"),
          supportedPaymentSourceId: input.supportedPaymentSourceId,
          paymentPayload:
            input.paymentPayload as unknown as VerifyPaymentPayload,
        });

        return c.json(result, 200);
      } catch (error) {
        handleRouteError(error, "x402 verify failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/settle",
      tags: ["x402"],
      summary: "Settle inbound x402 payment",
      description:
        "Settle a verified payment on-chain through the chain facilitator. Idempotent per payment payload.",
      security,
      request: {
        body: {
          content: { "application/json": { schema: verifySettleSchemaInput } },
        },
      },
      responses: {
        200: {
          description: "Settlement result",
          content: { "application/json": { schema: settleSchemaOutput } },
        },
        ...stdResponses,
      },
    }),
    async (c) => {
      try {
        const authContext = await getAuthenticatedOrThrow(c.req.raw, {
          requireEmailVerified: false,
        });
        await requireX402PayAccess(authContext);
        const input = c.req.valid("json");

        const { webhook, ...result } = await settleX402Payment({
          settleOnPaymentNode: settleX402PaymentOnNode,
          userId: authContext.user.id,
          organizationId: authContext.activeOrganizationId,
          apiKeyId: await resolveX402ApiKeyId(authContext, input.apiKeyId),
          caip2NetworkLimit: getCaip2NetworkLimitFromAuth(authContext, "write"),
          supportedPaymentSourceId: input.supportedPaymentSourceId,
          paymentPayload:
            input.paymentPayload as unknown as VerifyPaymentPayload,
        });

        if (!result.replay && webhook != null) {
          triggerX402Payment(authContext.user.id, webhook.success, {
            ...webhook,
            settledAt: new Date().toISOString(),
          });
        }

        return c.json(
          {
            ...result,
            settleResponse: {
              ...result.settleResponse,
              network: String(result.settleResponse.network),
            },
          },
          200,
        );
      } catch (error) {
        handleRouteError(error, "x402 settle failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/pay",
      tags: ["x402"],
      summary: "Sign outbound x402 payment",
      description:
        "Sign an outbound payment for a forwarded HTTP 402 response. Returns the X-PAYMENT header payload. Custodied wallets may return 402 when budget or on-chain balance is insufficient.",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: createPaymentSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Signed payment",
          content: {
            "application/json": { schema: createPaymentSchemaOutput },
          },
        },
        ...stdResponses,
      },
    }),
    async (c) => {
      try {
        const authContext = await getAuthenticatedOrThrow(c.req.raw, {
          requireEmailVerified: false,
        });
        await requireX402PayAccess(authContext);
        const input = c.req.valid("json");
        const scope = x402Scope(authContext, "write");
        const apiKeyId = await requireX402ApiKeyIdForPay(
          authContext,
          input.apiKeyId,
        );
        const caip2NetworkLimit = getCaip2NetworkLimitFromAuth(
          authContext,
          "write",
        );

        const proxied = await proxyCreateX402PaymentIfCustodied(
          authContext.user.id,
          scope,
          {
            apiKeyId,
            caip2NetworkLimit,
            evmWalletId: input.evmWalletId,
            paymentRequired:
              input.paymentRequired as unknown as OutboundPaymentRequired,
            preferredNetwork: input.preferredNetwork,
            preferredAsset: input.preferredAsset,
            paymentIdentifier: input.paymentIdentifier,
          },
        );
        if (proxied != null) {
          return c.json(
            {
              ...proxied,
              caip2Network: String(proxied.caip2Network),
              paymentPayload: proxied.paymentPayload as Record<string, unknown>,
            },
            200,
          );
        }

        const result = await createX402Payment({
          ...scope,
          apiKeyId,
          caip2NetworkLimit,
          evmWalletId: input.evmWalletId,
          paymentRequired:
            input.paymentRequired as unknown as OutboundPaymentRequired,
          preferredNetwork: input.preferredNetwork,
          preferredAsset: input.preferredAsset,
          paymentIdentifier: input.paymentIdentifier,
        });

        return c.json(
          {
            ...result,
            caip2Network: String(result.caip2Network),
            paymentPayload: result.paymentPayload as Record<string, unknown>,
          },
          200,
        );
      } catch (error) {
        handleRouteError(error, "x402 pay failed");
      }
    },
  );
}
