import { createRoute } from "@hono/zod-openapi";

import { NETWORK_REGISTER_CORS_OPTIONS } from "@/lib/network-registration/cors";
import { getNetworkRegisterCapabilities } from "@/lib/payment-node/registry-capabilities";
import { noSecurity } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["GET", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register/capabilities");

app.use("*", honoCors(CORS_METHODS, NETWORK_REGISTER_CORS_OPTIONS));

const capabilitiesSchema = z.object({
  browserWalletMintSupported: z.boolean(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Network"],
    summary: "Network registration capabilities",
    description:
      "Feature flags for the public register wizard (e.g. browser wallet mint requires payment-node support).",
    security: noSecurity,
    responses: {
      200: {
        description: "Capabilities",
        content: { "application/json": { schema: capabilitiesSchema } },
      },
    },
  }),
  (c) => c.json(getNetworkRegisterCapabilities()),
);

export const GET = nextHandlers(app).GET;
export const OPTIONS = nextHandlers(app).OPTIONS;
