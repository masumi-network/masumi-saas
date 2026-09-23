import { createRoute } from "@hono/zod-openapi";
import {
  deleteX402LowBalanceRule,
  listX402LowBalanceRules,
  setX402LowBalanceRule,
  updateX402LowBalanceRule,
} from "@masumi/payment-source-x402";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import {
  assertCaip2WithinWriteScope,
  requireX402AdminRead,
  requireX402AdminWrite,
  serializeLowBalanceRule,
} from "@/lib/x402/route-support";
import {
  deleteLowBalanceRuleSchemaInput,
  deleteLowBalanceRuleSchemaOutput,
  listLowBalanceRulesSchemaInput,
  listLowBalanceRulesSchemaOutput,
  lowBalanceRuleSchema,
  setLowBalanceRuleSchemaInput,
  updateLowBalanceRuleSchemaInput,
} from "@/lib/x402/schemas";

import { handleRouteError, type X402App, x402Scope } from "./route-context";

export function registerX402AlertsRoutes(app: X402App): void {
  app.openapi(
    createRoute({
      method: "get",
      path: "/low-balance",
      tags: ["x402"],
      summary: "List x402 low-balance rules",
      security,
      request: { query: listLowBalanceRulesSchemaInput },
      responses: {
        200: {
          description: "Low-balance rules",
          content: {
            "application/json": { schema: listLowBalanceRulesSchemaOutput },
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

        const Rules = (
          await listX402LowBalanceRules({
            ...x402Scope(authContext),
            evmWalletId: query.evmWalletId,
            onlyLow: query.onlyLow,
            includeDisabled: query.includeDisabled,
          })
        ).map(serializeLowBalanceRule);

        return c.json({ Rules }, 200);
      } catch (error) {
        handleRouteError(error, "x402 list low-balance rules failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/low-balance",
      tags: ["x402"],
      summary: "Set x402 low-balance rule",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: setLowBalanceRuleSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Low-balance rule",
          content: { "application/json": { schema: lowBalanceRuleSchema } },
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
        assertCaip2WithinWriteScope(authContext, input.caip2Network);

        const rule = serializeLowBalanceRule(
          await setX402LowBalanceRule({
            ...x402Scope(authContext, "write"),
            ...input,
          }),
        );

        return c.json(rule, 200);
      } catch (error) {
        handleRouteError(error, "x402 set low-balance rule failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/low-balance",
      tags: ["x402"],
      summary: "Update x402 low-balance rule",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: updateLowBalanceRuleSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Updated low-balance rule",
          content: { "application/json": { schema: lowBalanceRuleSchema } },
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

        const rule = serializeLowBalanceRule(
          await updateX402LowBalanceRule({
            ...x402Scope(authContext, "write"),
            ...input,
          }),
        );

        return c.json(rule, 200);
      } catch (error) {
        handleRouteError(error, "x402 update low-balance rule failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/low-balance",
      tags: ["x402"],
      summary: "Delete x402 low-balance rule",
      security,
      request: {
        body: {
          content: {
            "application/json": { schema: deleteLowBalanceRuleSchemaInput },
          },
        },
      },
      responses: {
        200: {
          description: "Deleted rule id",
          content: {
            "application/json": { schema: deleteLowBalanceRuleSchemaOutput },
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

        const result = await deleteX402LowBalanceRule(
          x402Scope(authContext, "write"),
          input.ruleId,
        );

        return c.json(
          {
            ...result,
            deletedAt: result.deletedAt.toISOString(),
          },
          200,
        );
      } catch (error) {
        handleRouteError(error, "x402 delete low-balance rule failed");
      }
    },
  );
}
