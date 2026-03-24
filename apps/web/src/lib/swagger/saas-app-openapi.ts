/**
 * OpenAPI 3 document for the Masumi SaaS app API (`/api/*`).
 * Public agent listing for third parties stays on `GET /api/v1/openapi` / `/docs/openapi`.
 */

import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

import { activityQueryInputSchema } from "@/lib/schemas/activity";
import {
  agentsListQuerySchema,
  registerAgentBodySchema,
  verifyAgentBodySchema,
} from "@/lib/schemas/agent";
import {
  agentCountsQuerySchema,
  agentEarningsQuerySchema,
  dashboardOverviewQuerySchema,
  earningsQuerySchema,
} from "@/lib/schemas/api-query";

import { z } from "./zod-openapi";

/** OpenAPI 3.0 security requirement entry (scheme name → scope list). */
type SecurityRequirementObject = Record<string, string[]>;

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "apiKeyHeader", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
  description:
    "Masumi SaaS API key from **API Keys** in the app. Send only this header (no Bearer scheme in this spec).",
});

/** Documented auth for Try it out: `x-api-key` only. Browser session cookies still work same-origin but are not listed here. */
const security: SecurityRequirementObject[] = [{ apiKeyHeader: [] }];

/** Public operations (no API key in Try it out). */
const noSecurity: SecurityRequirementObject[] = [];

/** Same validation as `POST /api/agents` — documented shape + Try-it-out example. */
const registerAgentOpenApiBodySchema = registerAgentBodySchema.openapi({
  description:
    'At least one tag is required: send `tags` as a comma-separated string (e.g. `"research, nlp"`).',
  example: {
    name: "Research assistant",
    description: "Helps with literature review",
    extendedDescription: "",
    apiUrl: "https://agent.example.com/mip",
    tags: "research, nlp",
    icon: "bot",
    pricing: {
      pricingType: "Fixed",
      prices: [{ amount: "5", currency: "USD" }],
    },
    termsOfUseUrl: "https://example.com/terms",
    privacyPolicyUrl: "https://example.com/privacy",
    otherUrl: "",
    capabilityName: "Masumi",
    capabilityVersion: "1.0",
    exampleOutputs: [
      {
        name: "Sample output",
        url: "https://example.com/sample.json",
        mimeType: "application/json",
      },
    ],
  },
});

const verifyAgentOpenApiBodySchema = verifyAgentBodySchema.openapi({
  description:
    "Veridian **aid** (required). Optional **schemaSaid** to select a credential schema; defaults to the agent verification schema when omitted.",
  example: { aid: "EXAMPLE_AID", schemaSaid: "optional_schema_said" },
});

const verificationChallengePostBodySchema = z
  .object({
    regenerate: z.boolean().optional().openapi({
      description: "If true, issue a new challenge and invalidate the previous",
      example: true,
    }),
  })
  .openapi({
    description:
      "Empty object `{}` is valid; pass `regenerate: true` to rotate the challenge.",
    example: { regenerate: true },
  });

const agentId = z.string().openapi({
  description: "Agent ID (CUID)",
  example: "cmlf6gswz0000x1uctad958tq",
});

/** One `Agent` row as returned in `GET /api/agents` (scalar fields as JSON). */
const agentListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  extendedDescription: z.string().nullable(),
  apiUrl: z.string(),
  organizationId: z.string().nullable(),
  registrationState: z.string(),
  verificationStatus: z
    .enum(["PENDING", "VERIFIED", "REVOKED", "EXPIRED"])
    .nullable(),
  tags: z.array(z.string()),
  metadata: z.string().nullable(),
  icon: z.string().nullable(),
  agentIdentifier: z.string().nullable(),
  networkIdentifier: z.string().nullable(),
  pricing: z.any().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  veridianCredentialId: z.string().nullable(),
  verificationChallenge: z.string().nullable().openapi({
    description:
      "Challenge for the agent verification URL flow; null until generated. Treat as sensitive when set.",
  }),
  verificationChallengeGeneratedAt: z.string().nullable().openapi({
    description: "ISO time the challenge was issued; null if none.",
  }),
  verificationSecret: z.string().nullable().openapi({
    description:
      "HMAC secret for proving ownership of the verification endpoint; null until generated. Never log or expose client-side.",
  }),
});

const agentsListSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.array(agentListItemSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi({
    example: {
      success: true,
      nextCursor: null,
      data: [
        {
          id: "cmlf6gswz0000x1uctad958tq",
          userId: "clu01exampleuser0001",
          name: "Research assistant",
          description: "Helps with literature review",
          extendedDescription: null,
          apiUrl: "https://agent.example.com/mip",
          organizationId: null,
          registrationState: "RegistrationConfirmed",
          verificationStatus: "VERIFIED",
          tags: ["research", "nlp"],
          metadata: null,
          icon: "bot",
          agentIdentifier: "policy1.assetname1",
          networkIdentifier: "Preprod",
          pricing: {
            pricingType: "Fixed",
            prices: [{ amount: "5", currency: "USD" }],
          },
          createdAt: "2025-01-15T12:00:00.000Z",
          updatedAt: "2025-01-20T08:30:00.000Z",
          veridianCredentialId: null,
          verificationChallenge: null,
          verificationChallengeGeneratedAt: null,
          verificationSecret: null,
        },
      ],
    },
  });

const exampleAgentItem = {
  id: "cmlf6gswz0000x1uctad958tq",
  userId: "clu01exampleuser0001",
  name: "Research assistant",
  description: "Helps with literature review",
  extendedDescription: null,
  apiUrl: "https://agent.example.com/mip",
  organizationId: null,
  registrationState: "RegistrationConfirmed",
  verificationStatus: "VERIFIED" as const,
  tags: ["research", "nlp"],
  metadata: null,
  icon: "bot",
  agentIdentifier: "policy1.assetname1",
  networkIdentifier: "Preprod",
  pricing: {
    pricingType: "Fixed",
    prices: [{ amount: "5", currency: "USD" }],
  },
  createdAt: "2025-01-15T12:00:00.000Z",
  updatedAt: "2025-01-20T08:30:00.000Z",
  veridianCredentialId: null,
  verificationChallenge: null,
  verificationChallengeGeneratedAt: null,
  verificationSecret: null,
};

const startRegistrationSuccessSchema = z
  .object({
    success: z.literal(true),
    agentId: z.string(),
    data: agentListItemSchema,
  })
  .openapi({
    example: {
      success: true,
      agentId: "cmlf6gswz0000x1uctad958tq",
      data: exampleAgentItem,
    },
  });

const agentDetailSuccessSchema = z
  .object({
    success: z.literal(true),
    data: agentListItemSchema,
  })
  .openapi({
    example: { success: true, data: exampleAgentItem },
  });

const agentDeletedSuccessSchema = z
  .object({ success: z.literal(true) })
  .openapi({ example: { success: true } });

const agentCountsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      all: z.number(),
      registered: z.number(),
      deregistered: z.number(),
      pending: z.number(),
      failed: z.number(),
      verified: z.number(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        all: 5,
        registered: 3,
        deregistered: 0,
        pending: 1,
        failed: 0,
        verified: 2,
      },
    },
  });

const agentTransactionRowSchema = z.object({
  id: z.string(),
  type: z.enum(["payment", "purchase"]),
  txHash: z.string().nullable(),
  amount: z.string(),
  network: z.string(),
  status: z.string(),
  unlockTime: z.string().nullable(),
  createdAt: z.string(),
});

const agentTransactionsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      transactions: z.array(agentTransactionRowSchema),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        transactions: [
          {
            id: "pay_01",
            type: "payment" as const,
            txHash: "abc123…",
            amount: "10 ADA",
            network: "Preprod",
            status: "FundsLocked",
            unlockTime: null,
            createdAt: "2025-01-18T09:00:00.000Z",
          },
        ],
      },
    },
  });

const incomeMoneyBlockSchema = z.object({
  units: z.array(z.object({ unit: z.string(), amount: z.number() })),
  blockchainFees: z.number(),
});

const agentEarningsDayMonthSchema = z.object({
  day: z.number().optional(),
  month: z.number(),
  year: z.number(),
  units: z.array(z.object({ unit: z.string(), amount: z.number() })),
  blockchainFees: z.number(),
});

const agentEarningsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      totalTransactions: z.number(),
      totalIncome: incomeMoneyBlockSchema,
      totalRefunded: incomeMoneyBlockSchema,
      totalPending: incomeMoneyBlockSchema,
      periodStart: z.string().nullable(),
      periodEnd: z.string().nullable(),
      dailyIncome: z.array(agentEarningsDayMonthSchema).optional(),
      monthlyIncome: z.array(agentEarningsDayMonthSchema).optional(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        totalTransactions: 12,
        totalIncome: {
          units: [{ unit: "ADA", amount: 45.2 }],
          blockchainFees: 0.35,
        },
        totalRefunded: { units: [], blockchainFees: 0 },
        totalPending: {
          units: [{ unit: "ADA", amount: 2 }],
          blockchainFees: 0.02,
        },
        periodStart: "2025-01-01",
        periodEnd: "2025-01-24",
        dailyIncome: [
          {
            day: 20,
            month: 1,
            year: 2025,
            units: [{ unit: "ADA", amount: 3.5 }],
            blockchainFees: 0.01,
          },
        ],
        monthlyIncome: [
          {
            month: 1,
            year: 2025,
            units: [{ unit: "ADA", amount: 45.2 }],
            blockchainFees: 0.35,
          },
        ],
      },
    },
  });

const verifyAgentSuccessSchema = z
  .object({
    success: z.literal(true),
    data: agentListItemSchema,
  })
  .openapi({
    example: {
      success: true,
      data: {
        ...exampleAgentItem,
        verificationStatus: "VERIFIED" as const,
      },
    },
  });

const verificationChallengeSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      challenge: z.string(),
      secret: z.string(),
      generatedAt: z.string().nullable(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        challenge: "550e8400-e29b-41d4-a716-446655440000",
        secret: "a1b2c3…64hex",
        generatedAt: "2025-01-20T11:00:00.000Z",
      },
    },
  });

const testVerificationEndpointSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({ message: z.string() }),
  })
  .openapi({
    example: {
      success: true,
      data: { message: "Endpoint is working correctly." },
    },
  });

const completeRegistrationSuccessSchema = z
  .object({
    success: z.literal(true),
    status: z.literal("registered"),
    data: agentListItemSchema,
  })
  .openapi({
    example: {
      success: true,
      status: "registered" as const,
      data: exampleAgentItem,
    },
  });

const completeRegistrationPendingSchema = z
  .object({
    success: z.literal(true),
    status: z.literal("pending"),
    message: z.string(),
  })
  .openapi({
    example: {
      success: true,
      status: "pending" as const,
      message: "Wallet not yet funded. Poll again in a few seconds.",
    },
  });

const dashboardOverviewExample = {
  user: {
    id: "clu01exampleuser0001",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
  },
  kycStatus: "APPROVED" as const,
  kycCompletedAt: "2025-01-10T00:00:00.000Z",
  kycRejectionReason: null as string | null,
  organizations: [{ id: "org1", name: "Lab", slug: "lab", role: "OWNER" }],
  organizationCount: 1,
  agents: [
    {
      id: "cmlf6gswz0000x1uctad958tq",
      name: "Research assistant",
      icon: "bot",
      registrationState: "RegistrationConfirmed",
      verificationStatus: "VERIFIED",
      pricing: null as null,
    },
  ],
  apiKeys: [{ id: "key1", name: "CI", prefix: "msk_", start: "msk_ab" }],
  apiKeyCount: 1,
  agentCount: 1,
  verifiedAgentCount: 1,
  runningAgentCount: 1,
  pendingAgentCount: 0,
  failedAgentCount: 0,
  balance: "0",
};

const dashboardOverviewDataSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
  }),
  kycStatus: z.enum([
    "PENDING",
    "REVIEW",
    "APPROVED",
    "REJECTED",
    "VERIFIED",
    "REVOKED",
    "EXPIRED",
  ]),
  kycCompletedAt: z.string().nullable(),
  kycRejectionReason: z.string().nullable(),
  kycError: z.string().optional(),
  organizations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      role: z.string(),
    }),
  ),
  organizationCount: z.number(),
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string().nullable(),
      registrationState: z.string(),
      verificationStatus: z.string().nullable(),
      pricing: z.any().nullable().optional(),
    }),
  ),
  apiKeys: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      prefix: z.string().nullable(),
      start: z.string().nullable(),
    }),
  ),
  apiKeyCount: z.number(),
  agentCount: z.number(),
  verifiedAgentCount: z.number(),
  runningAgentCount: z.number(),
  pendingAgentCount: z.number(),
  failedAgentCount: z.number(),
  balance: z.string(),
});

const dashboardOverviewSuccessSchema = z
  .object({
    success: z.literal(true),
    data: dashboardOverviewDataSchema,
  })
  .openapi({
    example: { success: true, data: dashboardOverviewExample },
  });

const activityLifecycleItemSchema = z.object({
  kind: z.literal("lifecycle"),
  id: z.string(),
  date: z.string(),
  type: z.string(),
  agentId: z.string().nullable(),
  agentName: z.string().nullable(),
});

const activityTransactionItemSchema = z.object({
  kind: z.literal("transaction"),
  id: z.string(),
  date: z.string(),
  type: z.enum(["payment", "purchase"]),
  agentId: z.string().nullable(),
  agentName: z.string().nullable(),
  amount: z.string(),
  status: z.string(),
  txHash: z.string().nullable(),
});

const activityFeedDataSchema = z.object({
  items: z.array(
    z.discriminatedUnion("kind", [
      activityLifecycleItemSchema,
      activityTransactionItemSchema,
    ]),
  ),
  lastUpdate: z.string().optional(),
});

const activitySummaryDataSchema = z.object({
  totalTransactions: z.number(),
  totalActivity: z.number(),
  lastUpdate: z.string().optional(),
});

const activitySuccessSchema = z
  .union([
    z.object({ success: z.literal(true), data: activityFeedDataSchema }),
    z.object({ success: z.literal(true), data: activitySummaryDataSchema }),
  ])
  .openapi({
    description:
      "With `summary=true`, `data` has `totalTransactions` and `totalActivity`; otherwise `data.items` is the feed.",
    example: {
      success: true,
      data: {
        items: [
          {
            kind: "lifecycle" as const,
            id: "evt1",
            date: "2025-01-20T10:00:00.000Z",
            type: "AgentRegistered",
            agentId: "cmlf6gswz0000x1uctad958tq",
            agentName: "Research assistant",
          },
          {
            kind: "transaction" as const,
            id: "pay_01",
            date: "2025-01-19T15:30:00.000Z",
            type: "payment" as const,
            agentId: "cmlf6gswz0000x1uctad958tq",
            agentName: "Research assistant",
            amount: "10 ADA",
            status: "FundsLocked",
            txHash: "abc123…",
          },
        ],
        lastUpdate: "2025-01-20T10:00:00.000Z",
      },
    },
  });

const userEarningsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      earnings: z.array(z.object({ date: z.string(), amount: z.number() })),
      total: z.number(),
      previousTotal: z.number().optional(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        earnings: [{ date: "2025-01-15", amount: 12.5 }],
        total: 12.5,
        previousTotal: 10,
      },
    },
  });

const errBody = z.object({
  success: z.literal(false),
  error: z.string(),
});

/**
 * Verify (and similar) 400 bodies: `details` may be a string[] (Zod issues) or a
 * credential-validation object — see `CredentialValidationResult` in Veridian types.
 */
const errBodyWithOptionalDetails = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional().openapi({
    description:
      "Optional: array of validation messages, or credential metadata (e.g. issuedAt, schemaSaid).",
  }),
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

/** 200 response with a concrete Zod schema + OpenAPI example (like richer service specs). */
function okWithSchema(description: string, schema: z.ZodType) {
  return {
    description,
    content: { "application/json": { schema } },
  };
}

const healthSuccessDataSchema = z.object({
  status: z.literal("ok"),
  paymentNode: z.union([
    z.object({ ok: z.literal(true) }),
    z.literal("skipped"),
  ]),
});

const healthSuccessSchema = z
  .object({
    success: z.literal(true),
    data: healthSuccessDataSchema,
  })
  .openapi({
    example: {
      success: true,
      data: { status: "ok", paymentNode: { ok: true } },
    },
  });

const healthServiceUnavailableSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
    data: z.object({
      status: z.literal("degraded"),
      paymentNode: z.object({ ok: z.literal(false) }),
    }),
  })
  .openapi({
    example: {
      success: false,
      error: "Payment node health check timed out",
      data: { status: "degraded", paymentNode: { ok: false } },
    },
  });

const apiKeyStatusSessionSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      authMethod: z.literal("session"),
      userId: z.string(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: { authMethod: "session", userId: "clu01exampleuser0001" },
    },
  });

const apiKeyStatusKeySchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      authMethod: z.literal("apiKey"),
      userId: z.string(),
      key: z.object({
        id: z.string(),
        name: z.string().nullable(),
        prefix: z.string().nullable(),
        start: z.string().nullable(),
        enabled: z.boolean(),
        createdAt: z.string(),
        lastRequest: z.string().nullable(),
      }),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        authMethod: "apiKey",
        userId: "clu01exampleuser0001",
        key: {
          id: "key_example_id",
          name: "CI",
          prefix: "mas_",
          start: "mas_ab12cd",
          enabled: true,
          createdAt: "2025-01-15T12:00:00.000Z",
          lastRequest: null,
        },
      },
    },
  });

// ── System ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  description:
    "Confirms this app and the Masumi payment service behind it are up. **503** means the payment service is unreachable or not reporting healthy.",
  security: noSecurity,
  responses: {
    200: okWithSchema(
      "App and payment service are healthy",
      healthSuccessSchema,
    ),
    429: {
      description: "Too many health checks from this client in the window",
      content: { "application/json": { schema: errBody } },
    },
    503: {
      description:
        "Payment service unreachable or unhealthy from this environment",
      content: {
        "application/json": { schema: healthServiceUnavailableSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api-key-status",
  tags: ["API keys"],
  summary: "API key status",
  description:
    "Returns whether the caller is authenticated with a **browser session** or a **Masumi SaaS API key** (`x-api-key` / `Authorization: Bearer`). For API key auth, includes public metadata for that key (id, name, prefix, start fragment). Does **not** echo the secret key.",
  security,
  responses: {
    200: {
      description:
        "`authMethod` is `session` for cookie auth, or `apiKey` when the request was authenticated with an API key.",
      content: {
        "application/json": {
          schema: z.union([apiKeyStatusSessionSchema, apiKeyStatusKeySchema]),
        },
      },
    },
    ...stdResponses,
  },
});

// ── Agents ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/agents",
  tags: ["Agents"],
  summary: "List agents",
  description:
    "Paginated list of the authenticated user’s agents. Effective **network** filter uses the `network` query param, or the `payment_network` cookie when the query is omitted.",
  security,
  request: {
    query: agentsListQuerySchema,
  },
  responses: {
    200: okWithSchema("Agent list", agentsListSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents",
  tags: ["Agents"],
  summary: "Start agent registration",
  description:
    "Creates a new agent and begins registration in Masumi SaaS. Returns **400** if `tags` is missing or empty after splitting on commas (at least one tag required).",
  security,
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerAgentOpenApiBodySchema,
        },
      },
    },
  },
  responses: {
    200: okWithSchema("Registration started", startRegistrationSuccessSchema),
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
    200: okWithSchema("Agent detail", agentDetailSuccessSchema),
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
    200: okWithSchema("Deleted", agentDeletedSuccessSchema),
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
  request: {
    query: agentCountsQuerySchema,
  },
  responses: {
    200: okWithSchema("Counts", agentCountsSuccessSchema),
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
    200: okWithSchema("Transactions", agentTransactionsSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/{agentId}/earnings",
  tags: ["Agents"],
  summary: "Agent earnings",
  security,
  request: {
    params: z.object({ agentId }),
    query: agentEarningsQuerySchema,
  },
  responses: {
    200: okWithSchema("Earnings", agentEarningsSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/agents/{agentId}/verify",
  tags: ["Agents"],
  summary: "Verify agent (credential flow)",
  security,
  request: {
    params: z.object({ agentId }),
    body: {
      content: {
        "application/json": {
          schema: verifyAgentOpenApiBodySchema,
        },
      },
    },
  },
  responses: {
    ...stdResponses,
    200: okWithSchema("Verification step result", verifyAgentSuccessSchema),
    400: {
      description:
        "Invalid body (e.g. missing `aid`), KYC/agent preconditions, or credential validation failure. May include `details` (string[] or credential metadata object).",
      content: {
        "application/json": { schema: errBodyWithOptionalDetails },
      },
    },
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
    200: okWithSchema("Challenge", verificationChallengeSuccessSchema),
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
          schema: verificationChallengePostBodySchema,
        },
      },
    },
  },
  responses: {
    200: okWithSchema("Challenge", verificationChallengeSuccessSchema),
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
    200: okWithSchema("Test result", testVerificationEndpointSuccessSchema),
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
    ...stdResponses,
    200: okWithSchema(
      "Registration completed on-chain",
      completeRegistrationSuccessSchema,
    ),
    202: {
      description:
        "Registration still pending (e.g. wallet funding); poll again shortly.",
      content: {
        "application/json": { schema: completeRegistrationPendingSchema },
      },
    },
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
    200: okWithSchema("Deregistered", agentDeletedSuccessSchema),
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
  request: {
    query: dashboardOverviewQuerySchema,
  },
  responses: {
    200: okWithSchema("Overview", dashboardOverviewSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/activity",
  tags: ["Activity"],
  summary: "Activity feed",
  description:
    "Cross-agent activity with filters (tab/type). Use `summary=1` for counts-only payload.",
  security,
  request: {
    query: activityQueryInputSchema,
  },
  responses: {
    200: okWithSchema("Activity feed or summary", activitySuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/earnings",
  tags: ["Earnings"],
  summary: "User earnings summary",
  security,
  request: {
    query: earningsQuerySchema,
  },
  responses: {
    200: okWithSchema("Earnings / payouts summary", userEarningsSuccessSchema),
    ...stdResponses,
  },
});

export function generateSaaSAppOpenAPISpec() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Masumi SaaS API",
      description: [
        "HTTP API for Masumi SaaS (same origin as the web app). Authenticate with a session cookie or the x-api-key header (see API Keys in the app).",
      ].join("\n"),
    },
    servers: [{ url: "/api", description: "This app" }],
    tags: [
      { name: "System", description: "Health and availability" },
      { name: "API keys", description: "Masumi SaaS API key introspection" },
      { name: "Agents", description: "Your agents" },
      { name: "Dashboard", description: "Overview and account data" },
      { name: "Activity", description: "What happened across your agents" },
      { name: "Earnings", description: "Earnings and payouts" },
    ],
  });
}
