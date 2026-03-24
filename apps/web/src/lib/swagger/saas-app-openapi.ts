/**
 * OpenAPI 3 document for the Masumi platform app API (`/api/*`).
 * Public agent listing for third parties stays on `GET /api/v1/openapi` / `/docs/openapi`.
 */

import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

import { z } from "./zod-openapi";

/** OpenAPI 3.0 security requirement entry (scheme name → scope list). */
type SecurityRequirementObject = Record<string, string[]>;

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "apiKeyHeader", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
  description:
    "Platform API key from **API Keys** in the app. Send only this header (no Bearer scheme in this spec).",
});

/** Documented auth for Try it out: `x-api-key` only. Browser session cookies still work same-origin but are not listed here. */
const security: SecurityRequirementObject[] = [{ apiKeyHeader: [] }];

const agentId = z.string().openapi({
  description: "Agent ID (CUID)",
  example: "cmlf6gswz0000x1uctad958tq",
});

const okData = z.object({
  success: z.literal(true),
  data: z.unknown().openapi({
    description: "Operation-specific JSON payload",
  }),
});

const errBody = z.object({
  success: z.literal(false),
  error: z.string(),
});

const stdResponses = {
  400: {
    description: "Validation or bad request",
    content: { "application/json": { schema: errBody } },
  },
  401: {
    description: "Unauthorized — valid session or API key required",
    content: { "application/json": { schema: errBody } },
  },
  403: {
    description: "Forbidden — insufficient role or feature not enabled",
    content: { "application/json": { schema: errBody } },
  },
  404: {
    description: "Resource not found",
    content: { "application/json": { schema: errBody } },
  },
  500: {
    description: "Server error",
    content: { "application/json": { schema: errBody } },
  },
} as const;

function ok(description: string) {
  return {
    description,
    content: { "application/json": { schema: okData } },
  };
}

// ── Agents ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/agents",
  tags: ["Agents"],
  summary: "List agents",
  description:
    "Paginated list of the authenticated user’s agents. Supports filters (verification status, registration state, network, search).",
  security,
  responses: {
    200: ok("Agent list"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents",
  tags: ["Agents"],
  summary: "Start agent registration",
  description: "Creates a new agent and begins on-platform registration.",
  security,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({}).passthrough().openapi({
            description: "Registration payload — see app UI / types",
          }),
        },
      },
    },
  },
  responses: {
    200: ok("Registration started"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/{agentId}",
  tags: ["Agents"],
  summary: "Get agent",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Agent detail"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/agents/{agentId}",
  tags: ["Agents"],
  summary: "Delete agent",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Deleted"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/counts",
  tags: ["Agents"],
  summary: "Aggregate agent counts",
  description: "Counts by status and network for the current user.",
  security,
  responses: {
    200: ok("Counts"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/{agentId}/transactions",
  tags: ["Agents"],
  summary: "Agent transactions",
  description: "Payment and purchase activity for one agent.",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Transactions"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/{agentId}/earnings",
  tags: ["Agents"],
  summary: "Agent earnings",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Earnings"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents/{agentId}/verify",
  tags: ["Agents"],
  summary: "Verify agent (credential flow)",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Verification step result"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/{agentId}/verification-challenge",
  tags: ["Agents"],
  summary: "Get verification challenge",
  description: "Returns the current verification challenge for the agent.",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Challenge"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents/{agentId}/verification-challenge",
  tags: ["Agents"],
  summary: "Refresh verification challenge",
  description:
    'Optional body `{ "regenerate": true }` to issue a new challenge and invalidate the previous.',
  security,
  request: {
    params: z.object({ agentId }),
    body: {
      content: {
        "application/json": {
          schema: z
            .object({ regenerate: z.boolean().optional() })
            .optional()
            .openapi({ description: "Omit or pass `{ regenerate: true }`" }),
        },
      },
    },
  },
  responses: {
    200: ok("Challenge"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents/{agentId}/test-verification-endpoint",
  tags: ["Agents"],
  summary: "Test agent verification URL",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Test result"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents/{agentId}/complete-registration",
  tags: ["Agents"],
  summary: "Complete on-chain registration",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Registration completed"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents/{agentId}/deregister",
  tags: ["Agents"],
  summary: "Deregister agent on-chain",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: ok("Deregistration result"),
    ...stdResponses,
  },
});

// ── Dashboard & activity ───────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/dashboard/overview",
  tags: ["Dashboard"],
  summary: "Dashboard overview",
  description:
    "User, organizations, agents, API keys, balance snapshot, KYC hints — scoped to the authenticated user.",
  security,
  responses: {
    200: ok("Overview"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/activity",
  tags: ["Activity"],
  summary: "Activity feed",
  description: "Cross-agent activity with filters (tab/type).",
  security,
  responses: {
    200: ok("Activity items"),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/earnings",
  tags: ["Earnings"],
  summary: "User earnings summary",
  security,
  responses: {
    200: ok("Earnings / payouts summary"),
    ...stdResponses,
  },
});

export function generateSaaSAppOpenAPISpec() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Masumi as a Service API",
      description:
        "The main API for the Masumi web app and integrations: agents, dashboard, activity, earnings, and payment-related actions when your account is set up for them.",
    },
    servers: [{ url: "/api", description: "This app" }],
    tags: [
      { name: "Agents", description: "Your agents" },
      { name: "Dashboard", description: "Overview and account data" },
      { name: "Activity", description: "What happened across your agents" },
      { name: "Earnings", description: "Earnings and payouts" },
    ],
  });
}
