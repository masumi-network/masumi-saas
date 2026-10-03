import { createRoute } from "@hono/zod-openapi";
import {
  listX402Networks,
  probeX402NetworkRpc,
  upsertX402Network,
} from "@masumi/payment-source-x402";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  getPaymentNodeX402NetworkByCaip2,
  listPaymentNodeX402Networks,
} from "@/lib/payment-node/resolve-payment-node-x402-network";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import {
  resolveChainsByCaip2Ids,
  searchChainsForX402,
} from "@/lib/x402/chain-registry";
import {
  assertCaip2WithinWriteScope,
  requireX402AdminRead,
  requireX402AdminWrite,
  serializeNetwork,
} from "@/lib/x402/route-support";
import {
  listNetworksSchemaInput,
  listNetworksSchemaOutput,
  listSupportedNetworksSchemaInput,
  listSupportedNetworksSchemaOutput,
  resolveChainsSchemaInput,
  resolveChainsSchemaOutput,
  searchChainsSchemaInput,
  searchChainsSchemaOutput,
  upsertNetworkSchemaInput,
  validateNetworkRpcSchemaInput,
  validateNetworkRpcSchemaOutput,
  x402NetworkSchema,
} from "@/lib/x402/schemas";

import { handleRouteError, type X402App, x402Scope } from "./route-context";

export function registerX402NetworksRoutes(app: X402App): void {
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
        await requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Networks = (
          await listX402Networks({
            ...x402Scope(authContext),
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
      method: "get",
      path: "/networks/supported",
      tags: ["x402"],
      summary: "List payment-node supported x402 EVM chains",
      description:
        "Chains registered on the payment node that tenants may configure or select in agent x402 options.",
      security,
      request: { query: listSupportedNetworksSchemaInput },
      responses: {
        200: {
          description: "Supported chains",
          content: {
            "application/json": { schema: listSupportedNetworksSchemaOutput },
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

        const Networks = await listPaymentNodeX402Networks({
          isTestnet: query.isTestnet,
        });

        return c.json({ Networks }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list supported networks failed");
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
        await requireX402AdminWrite(authContext);
        const input = c.req.valid("json");
        assertCaip2WithinWriteScope(authContext, input.caip2Id);

        const paymentNodeNetwork = await getPaymentNodeX402NetworkByCaip2(
          input.caip2Id,
        );

        const network = serializeNetwork(
          await upsertX402Network({
            ...x402Scope(authContext, "write"),
            createdByUserId: authContext.user.id,
            caip2Id: input.caip2Id,
            displayName: input.displayName || paymentNodeNetwork.displayName,
            rpcUrl: paymentNodeNetwork.rpcUrl,
            isTestnet: paymentNodeNetwork.isTestnet,
            isEnabled: input.isEnabled,
            defaultAsset: input.defaultAsset,
            facilitatorWalletId: input.facilitatorWalletId,
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
      method: "post",
      path: "/networks/validate-rpc",
      tags: ["x402"],
      summary: "Probe an x402 EVM network RPC URL",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: validateNetworkRpcSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "RPC probe result",
          content: {
            "application/json": { schema: validateNetworkRpcSchemaOutput },
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
        assertCaip2WithinWriteScope(authContext, input.caip2Id);

        return c.json(await probeX402NetworkRpc(input), 200);
      } catch (error) {
        handleRouteError(error, "x402 validate network rpc failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/chains/search",
      tags: ["x402"],
      summary: "Search public EVM chain metadata for x402 setup",
      security,
      request: { query: searchChainsSchemaInput },
      responses: {
        200: {
          description: "Matching chains",
          content: {
            "application/json": { schema: searchChainsSchemaOutput },
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

        const chains = await searchChainsForX402({
          q: query.q,
          testnet: query.testnet,
          limit: query.limit,
        });

        return c.json({ chains }, 200);
      } catch (error) {
        handleRouteError(error, "x402 search chains failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/chains/resolve",
      tags: ["x402"],
      summary: "Resolve public EVM chain metadata for configured networks",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: resolveChainsSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Resolved chains",
          content: {
            "application/json": { schema: resolveChainsSchemaOutput },
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
        const input = c.req.valid("json");

        const chains = await resolveChainsByCaip2Ids(input.caip2Ids);

        return c.json({ chains }, 200);
      } catch (error) {
        handleRouteError(error, "x402 resolve chains failed");
      }
    },
  );
}
