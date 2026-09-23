import { createRoute } from "@hono/zod-openapi";
import {
  confirmX402WalletBackup,
  countX402ManagedWallets,
  getX402WalletBalances,
  listX402ManagedWallets,
} from "@masumi/payment-source-x402";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import { createX402WalletWithCustody } from "@/lib/x402/create-wallet";
import {
  requireX402AdminRead,
  requireX402AdminWrite,
  serializeWallet,
} from "@/lib/x402/route-support";
import {
  cancelPendingWalletSchemaInput,
  confirmWalletBackupSchemaInput,
  countSchemaOutput,
  createWalletSchemaInput,
  createWalletSchemaOutput,
  deleteWalletSchemaInput,
  deleteWalletSchemaOutput,
  listWalletsSchemaInput,
  listWalletsSchemaOutput,
  updateWalletSchemaInput,
  walletBalanceSchemaInput,
  walletBalanceSchemaOutput,
  walletSchemaOutput,
  walletsCountSchemaInput,
} from "@/lib/x402/schemas";
import {
  cancelX402PendingWalletWithCustody,
  deleteX402WalletWithCustody,
  updateX402WalletWithCustody,
} from "@/lib/x402/wallet-custody-ops";

import { handleRouteError, type X402App, x402Scope } from "./route-context";

export function registerX402WalletsRoutes(app: X402App): void {
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
        await requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Wallets = (
          await listX402ManagedWallets({
            ...x402Scope(authContext),
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
        await requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const wallet = serializeWallet(
          await createX402WalletWithCustody({
            userId: authContext.user.id,
            organizationId: authContext.activeOrganizationId,
            createdByUserId: authContext.user.id,
            type: input.type,
            note: input.note,
            privateKey: input.privateKey,
            caip2Network: input.caip2Network,
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
        await requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const wallet = serializeWallet(
          await updateX402WalletWithCustody(authContext.user.id, {
            ...x402Scope(authContext, "write"),
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
        await requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const result = await deleteX402WalletWithCustody(
          authContext.user.id,
          x402Scope(authContext, "write"),
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
      method: "post",
      path: "/wallets/confirm-backup",
      tags: ["x402"],
      summary: "Confirm managed wallet private-key backup",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: confirmWalletBackupSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Confirmed wallet",
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
        await requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const wallet = serializeWallet(
          await confirmX402WalletBackup(
            x402Scope(authContext, "write"),
            input.id,
          ),
        );

        return c.json(wallet, 200);
      } catch (error) {
        handleRouteError(error, "x402 confirm wallet backup failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/wallets/cancel-pending",
      tags: ["x402"],
      summary: "Cancel a pending managed wallet before backup is confirmed",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: cancelPendingWalletSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Cancelled pending wallet id",
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
        await requireX402AdminWrite(authContext);
        const input = c.req.valid("json");

        const result = await cancelX402PendingWalletWithCustody(
          authContext.user.id,
          x402Scope(authContext, "write"),
          input.id,
        );

        return c.json(result, 200);
      } catch (error) {
        handleRouteError(error, "x402 cancel pending wallet failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/wallets/balance",
      tags: ["x402"],
      summary: "Read managed EVM wallet balances",
      security,
      request: { query: walletBalanceSchemaInput },
      responses: {
        200: {
          description: "On-chain wallet balances",
          content: {
            "application/json": { schema: walletBalanceSchemaOutput },
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
        await requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const balances = await getX402WalletBalances({
          ...x402Scope(authContext),
          evmWalletId: query.id,
          caip2Network: query.caip2Network,
        });

        return c.json(balances, 200);
      } catch (error) {
        handleRouteError(error, "x402 wallet balance failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/wallets/count",
      tags: ["x402"],
      summary: "Count managed EVM wallets",
      security,
      request: { query: walletsCountSchemaInput },
      responses: {
        200: {
          description: "Wallet count",
          content: { "application/json": { schema: countSchemaOutput } },
        },
        ...stdResponses,
      },
    }),
    async (c) => {
      try {
        const authContext = await getAuthenticatedOrThrow(c.req.raw, {
          requireEmailVerified: false,
        });
        await requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const total = await countX402ManagedWallets({
          ...x402Scope(authContext),
          type: query.type,
        });

        return c.json({ total }, 200);
      } catch (error) {
        handleRouteError(error, "x402 wallet count failed");
      }
    },
  );
}
