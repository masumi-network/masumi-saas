import { createRoute } from "@hono/zod-openapi";
import {
  deleteX402WalletBudget,
  listX402WalletBudgets,
  setX402WalletBudget,
} from "@masumi/payment-source-x402";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import { requireX402ApiKeyIdForPay } from "@/lib/x402/resolve-api-key";
import {
  assertCaip2WithinWriteScope,
  requireX402BudgetRead,
  requireX402BudgetWrite,
  serializeBudget,
} from "@/lib/x402/route-support";
import {
  budgetSchema,
  deleteBudgetSchemaInput,
  deleteBudgetSchemaOutput,
  listBudgetSchemaInput,
  listBudgetSchemaOutput,
  setBudgetSchemaInput,
} from "@/lib/x402/schemas";

import { handleRouteError, type X402App, x402Scope } from "./route-context";

export function registerX402BudgetsRoutes(app: X402App): void {
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
        await requireX402BudgetRead(authContext);
        const query = c.req.valid("query");

        const Budgets = (
          await listX402WalletBudgets({
            ...x402Scope(authContext),
            apiKeyId: query.apiKeyId,
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
        await requireX402BudgetWrite(authContext);
        const input = c.req.valid("json");
        assertCaip2WithinWriteScope(authContext, input.caip2Network);
        const apiKeyId = await requireX402ApiKeyIdForPay(
          authContext,
          input.apiKeyId,
        );

        const budget = serializeBudget(
          await setX402WalletBudget({
            ...x402Scope(authContext, "write"),
            createdByUserId: authContext.user.id,
            ...input,
            apiKeyId,
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
      method: "delete",
      path: "/budgets",
      tags: ["x402"],
      summary: "Delete x402 wallet budget",
      security,
      request: {
        body: {
          content: { "application/json": { schema: deleteBudgetSchemaInput } },
        },
      },
      responses: {
        200: {
          description: "Budget deleted",
          content: {
            "application/json": { schema: deleteBudgetSchemaOutput },
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
        await requireX402BudgetWrite(authContext);
        const { budgetId } = c.req.valid("json");

        const result = await deleteX402WalletBudget(
          x402Scope(authContext, "write"),
          budgetId,
        );

        return c.json(
          {
            budgetId: result.budgetId,
            deletedAt: result.deletedAt.toISOString(),
          },
          200,
        );
      } catch (error) {
        handleRouteError(error, "x402 delete budget failed");
      }
    },
  );
}
