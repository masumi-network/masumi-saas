import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import {
  createX402ManagedWallet,
  createX402Payment,
  deleteX402ManagedWallet,
  listX402ManagedWallets,
  listX402Networks,
  listX402PaymentAttempts,
  listX402Settlements,
  listX402WalletBudgets,
  settleX402Payment,
  setX402WalletBudget,
  updateX402ManagedWallet,
  upsertX402Network,
  verifyX402Payment,
} from "@masumi/payment-source-x402/service";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import {
  getCaip2NetworkLimitFromAuth,
  requireX402AdminRead,
  requireX402AdminWrite,
  requireX402PayAccess,
  rethrowIfHttpError,
  serializeBudget,
  serializeNetwork,
  serializePaymentAttempt,
  serializeSettlement,
  serializeWallet,
} from "@/lib/x402/route-support";
import {
  budgetSchema,
  createPaymentSchemaInput,
  createPaymentSchemaOutput,
  createWalletSchemaInput,
  createWalletSchemaOutput,
  deleteWalletSchemaInput,
  deleteWalletSchemaOutput,
  listBudgetSchemaInput,
  listBudgetSchemaOutput,
  listNetworksSchemaInput,
  listNetworksSchemaOutput,
  listPaymentAttemptsSchemaInput,
  listPaymentAttemptsSchemaOutput,
  listSettlementsSchemaInput,
  listSettlementsSchemaOutput,
  listWalletsSchemaInput,
  listWalletsSchemaOutput,
  setBudgetSchemaInput,
  settleSchemaOutput,
  updateWalletSchemaInput,
  upsertNetworkSchemaInput,
  verifySchemaOutput,
  verifySettleSchemaInput,
  walletSchemaOutput,
  x402NetworkSchema,
} from "@/lib/x402/schemas";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";

type X402App = OpenAPIHono<Record<string, never>>;

type VerifyPaymentPayload = Parameters<
  typeof verifyX402Payment
>[0]["paymentPayload"];
type OutboundPaymentRequired = Parameters<
  typeof createX402Payment
>[0]["paymentRequired"];

function handleRouteError(error: unknown, label: string): never {
  if (error instanceof ApiError) throw error;
  rethrowIfAuthOrCreditsError(error);
  rethrowIfHttpError(error);
  console.error(`[x402] ${label}:`, error);
  throw new ApiError(500, label);
}

export function registerX402Routes(app: X402App): void {
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
        requireX402PayAccess(authContext);
        const input = c.req.valid("json");

        const result = await verifyX402Payment({
          userId: authContext.user.id,
          orgApiKeyId: input.orgApiKeyId,
          caip2NetworkLimit: getCaip2NetworkLimitFromAuth(authContext),
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
        requireX402PayAccess(authContext);
        const input = c.req.valid("json");

        const { webhook: _webhook, ...result } = await settleX402Payment({
          userId: authContext.user.id,
          orgApiKeyId: input.orgApiKeyId,
          caip2NetworkLimit: getCaip2NetworkLimitFromAuth(authContext),
          supportedPaymentSourceId: input.supportedPaymentSourceId,
          paymentPayload:
            input.paymentPayload as unknown as VerifyPaymentPayload,
        });

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
        "Sign an outbound payment for a forwarded HTTP 402 response. Debits a managed-wallet budget and returns the X-PAYMENT header payload.",
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
        requireX402PayAccess(authContext);
        const input = c.req.valid("json");

        const result = await createX402Payment({
          userId: authContext.user.id,
          orgApiKeyId: input.orgApiKeyId,
          caip2NetworkLimit: getCaip2NetworkLimitFromAuth(authContext),
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

  app.openapi(
    createRoute({
      method: "get",
      path: "/wallets",
      tags: ["x402"],
      summary: "List managed EVM wallets",
      security,
      request: { query: listWalletsSchemaInput },
      responses: {
        200: {
          description: "Managed wallets",
          content: {
            "application/json": { schema: listWalletsSchemaOutput },
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
        requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Wallets = (
          await listX402ManagedWallets({
            userId: authContext.user.id,
            take: query.take,
            cursorId: query.cursorId,
            type: query.type,
          })
        ).map(serializeWallet);

        return c.json({ Wallets }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list wallets failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/wallets",
      tags: ["x402"],
      summary: "Create managed EVM wallet",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: createWalletSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Created wallet",
          content: {
            "application/json": { schema: createWalletSchemaOutput },
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
        requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const wallet = serializeWallet(
          await createX402ManagedWallet({
            userId: authContext.user.id,
            organizationId: authContext.activeOrganizationId,
            createdByUserId: authContext.user.id,
            type: input.type,
            note: input.note,
            privateKey: input.privateKey,
          }),
        );

        return c.json(wallet, 200);
      } catch (error) {
        handleRouteError(error, "x402 create wallet failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/wallets/update",
      tags: ["x402"],
      summary: "Update managed EVM wallet note",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: updateWalletSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Updated wallet",
          content: {
            "application/json": { schema: walletSchemaOutput },
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
        requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const wallet = serializeWallet(
          await updateX402ManagedWallet({
            userId: authContext.user.id,
            id: input.id,
            note: input.note,
          }),
        );

        return c.json(wallet, 200);
      } catch (error) {
        handleRouteError(error, "x402 update wallet failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/wallets/delete",
      tags: ["x402"],
      summary: "Retire managed EVM wallet",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: deleteWalletSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Deleted wallet id",
          content: {
            "application/json": { schema: deleteWalletSchemaOutput },
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
        requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const result = await deleteX402ManagedWallet(
          authContext.user.id,
          input.id,
        );

        return c.json(result, 200);
      } catch (error) {
        handleRouteError(error, "x402 delete wallet failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/networks",
      tags: ["x402"],
      summary: "List x402 EVM networks",
      security,
      request: { query: listNetworksSchemaInput },
      responses: {
        200: {
          description: "Configured networks",
          content: {
            "application/json": { schema: listNetworksSchemaOutput },
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
        requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Networks = (
          await listX402Networks({
            userId: authContext.user.id,
            isTestnet: query.isTestnet,
          })
        ).map(serializeNetwork);

        return c.json({ Networks }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list networks failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/networks",
      tags: ["x402"],
      summary: "Upsert x402 EVM network",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: upsertNetworkSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Network configuration",
          content: {
            "application/json": { schema: x402NetworkSchema },
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
        requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const network = serializeNetwork(
          await upsertX402Network({
            userId: authContext.user.id,
            organizationId: authContext.activeOrganizationId,
            createdByUserId: authContext.user.id,
            ...input,
          }),
        );

        return c.json(network, 200);
      } catch (error) {
        handleRouteError(error, "x402 upsert network failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/budgets",
      tags: ["x402"],
      summary: "List x402 wallet budgets",
      security,
      request: { query: listBudgetSchemaInput },
      responses: {
        200: {
          description: "Wallet budgets",
          content: {
            "application/json": { schema: listBudgetSchemaOutput },
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
        requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Budgets = (
          await listX402WalletBudgets({
            userId: authContext.user.id,
            orgApiKeyId: query.orgApiKeyId,
          })
        ).map(serializeBudget);

        return c.json({ Budgets }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list budgets failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/budgets",
      tags: ["x402"],
      summary: "Set x402 wallet budget",
      security,
      request: {
        body: {
          content: { "application/json": { schema: setBudgetSchemaInput } },
        },
      },
      responses: {
        200: {
          description: "Budget record",
          content: { "application/json": { schema: budgetSchema } },
        },
        ...stdResponses,
      },
    }),
    async (c) => {
      try {
        const authContext = await getAuthenticatedOrThrow(c.req.raw, {
          requireEmailVerified: false,
        });
        requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const budget = serializeBudget(
          await setX402WalletBudget({
            userId: authContext.user.id,
            createdByUserId: authContext.user.id,
            ...input,
          }),
        );

        return c.json(budget, 200);
      } catch (error) {
        handleRouteError(error, "x402 set budget failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/payments",
      tags: ["x402"],
      summary: "List x402 payment attempts",
      security,
      request: { query: listPaymentAttemptsSchemaInput },
      responses: {
        200: {
          description: "Payment attempt audit log",
          content: {
            "application/json": { schema: listPaymentAttemptsSchemaOutput },
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
        requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const PaymentAttempts = (
          await listX402PaymentAttempts({
            userId: authContext.user.id,
            take: query.take,
            cursorId: query.cursorId,
            status: query.status,
            direction: query.direction,
            caip2Network: query.caip2Network,
          })
        ).map(serializePaymentAttempt);

        return c.json({ PaymentAttempts }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list payments failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/settlements",
      tags: ["x402"],
      summary: "List x402 settlements",
      security,
      request: { query: listSettlementsSchemaInput },
      responses: {
        200: {
          description: "Settlement records",
          content: {
            "application/json": { schema: listSettlementsSchemaOutput },
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
        requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Settlements = (
          await listX402Settlements({
            userId: authContext.user.id,
            take: query.take,
            cursorId: query.cursorId,
            caip2Network: query.caip2Network,
          })
        ).map(serializeSettlement);

        return c.json({ Settlements }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list settlements failed");
      }
    },
  );
}
