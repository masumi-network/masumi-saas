import { createRoute } from "@hono/zod-openapi";
import {
  countX402PaymentAttempts,
  countX402Settlements,
  getX402Analytics,
  listX402PaymentAttempts,
  listX402Settlements,
} from "@masumi/payment-source-x402";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import {
  requireX402AdminRead,
  serializePaymentAttempt,
  serializeSettlement,
} from "@/lib/x402/route-support";
import {
  analyticsSchemaInput,
  analyticsSchemaOutput,
  countSchemaOutput,
  listPaymentAttemptsSchemaInput,
  listPaymentAttemptsSchemaOutput,
  listSettlementsSchemaInput,
  listSettlementsSchemaOutput,
  paymentAttemptsCountSchemaInput,
  settlementsCountSchemaInput,
} from "@/lib/x402/schemas";

import { handleRouteError, type X402App, x402Scope } from "./route-context";

export function registerX402HistoryRoutes(app: X402App): void {
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
        await requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const PaymentAttempts = (
          await listX402PaymentAttempts({
            ...x402Scope(authContext),
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
        await requireX402AdminRead(authContext);
        const query = c.req.valid("query");

        const Settlements = (
          await listX402Settlements({
            ...x402Scope(authContext),
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

  app.openapi(
    createRoute({
      method: "get",
      path: "/payments/count",
      tags: ["x402"],
      summary: "Count x402 payment attempts",
      security,
      request: { query: paymentAttemptsCountSchemaInput },
      responses: {
        200: {
          description: "Payment attempt count",
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

        const total = await countX402PaymentAttempts({
          ...x402Scope(authContext),
          status: query.status,
          direction: query.direction,
          caip2Network: query.caip2Network,
        });

        return c.json({ total }, 200);
      } catch (error) {
        handleRouteError(error, "x402 payment count failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/settlements/count",
      tags: ["x402"],
      summary: "Count x402 settlements",
      security,
      request: { query: settlementsCountSchemaInput },
      responses: {
        200: {
          description: "Settlement count",
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

        const total = await countX402Settlements({
          ...x402Scope(authContext),
          caip2Network: query.caip2Network,
          success: query.success,
        });

        return c.json({ total }, 200);
      } catch (error) {
        handleRouteError(error, "x402 settlement count failed");
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/analytics",
      tags: ["x402"],
      summary: "Aggregate x402 payment analytics",
      security,
      request: {
        body: {
          content: { "application/json": { schema: analyticsSchemaInput } },
        },
      },
      responses: {
        200: {
          description: "Analytics buckets",
          content: { "application/json": { schema: analyticsSchemaOutput } },
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

        const analytics = await getX402Analytics({
          ...x402Scope(authContext),
          ...input,
        });

        return c.json(
          {
            ...analytics,
            periodStart: analytics.periodStart.toISOString(),
            periodEnd: analytics.periodEnd.toISOString(),
          },
          200,
        );
      } catch (error) {
        handleRouteError(error, "x402 analytics failed");
      }
    },
  );
}
