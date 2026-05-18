/**
 * OpenAPI 3 document for the Masumi SaaS app API (`/api/*`).
 * Public agent listing for third parties stays on `GET /api/v1/openapi` / `/docs/openapi`.
 *
 * Response bodies use Zod→OpenAPI where practical; some routes still use broad object schemas
 * when the handler shape is large or shared—tighten per-endpoint schemas incrementally for
 * richer Swagger “Example value” / client codegen.
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
  activityTransactionQuerySchema,
  agentAnalyticsQuerySchema,
  agentCountsQuerySchema,
  agentEarningsQuerySchema,
  credentialReconcileQuerySchema,
  credentialStatusQuerySchema,
  dashboardOverviewQuerySchema,
  earningsQuerySchema,
} from "@/lib/schemas/api-query";
import {
  registerByEmailApiBodySchema,
  registerByEmailApiSuccessSchema,
} from "@/lib/schemas/auth-api";
import {
  inboxAgentsListQuerySchema,
  registerInboxAgentBodySchema,
} from "@/lib/schemas/inbox-agent";
import { injectProxyRoutesIntoOpenApiDocument } from "@/lib/v1-proxy/manifest";

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

const prefixedWrapperServers = [{ url: "/", description: "This app" }];

/** Same validation as `POST /api/agents` — documented shape + Try-it-out example. */
const registerAgentOpenApiBodySchema = registerAgentBodySchema.openapi({
  description:
    'At least one tag is required: send `tags` as a comma-separated string (e.g. `"research, nlp"`). `pricing.pricingType` accepts `Free`, `Fixed`, or `Dynamic`. `prices` is required only when `pricingType` is `Fixed`; `Free` and `Dynamic` omit it (Dynamic amounts are set per payment/purchase request).',
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

const registerInboxAgentOpenApiBodySchema =
  registerInboxAgentBodySchema.openapi({
    description:
      "Registers an inbox agent under the active network. `agentSlug` is normalized server-side, and a configured server-side executing wallet pays for the registration and receives the registration asset.",
    example: {
      name: "Support inbox",
      description: "Routes support requests into the Masumi inbox registry",
      agentSlug: "support-inbox",
    },
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

/**
 * Full agent row shape at runtime (includes verification fields).
 * For OpenAPI / Swagger UI, use `agentListItemPublicSchema` so challenge/secret are not documented
 * (they still appear in JSON responses; do not rely on public docs for those keys).
 */
const agentListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  extendedDescription: z.string().nullable(),
  apiUrl: z.string().openapi({
    description:
      "Agent API base URL. In production it must be a public HTTPS endpoint.",
    example: "https://agent.example.com/mip",
  }),
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
  verificationChallenge: z.string().nullable(),
  verificationChallengeGeneratedAt: z.string().nullable(),
  verificationSecret: z.string().nullable(),
});

const agentListItemPublicSchema = agentListItemSchema.omit({
  verificationChallenge: true,
  verificationChallengeGeneratedAt: true,
  verificationSecret: true,
});

const agentsListSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.array(agentListItemPublicSchema),
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
};

const startRegistrationSuccessSchema = z
  .object({
    success: z.literal(true),
    agentId: z.string(),
    data: agentListItemPublicSchema,
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
    data: agentListItemPublicSchema,
  })
  .openapi({
    example: { success: true, data: exampleAgentItem },
  });

const agentDeletedSuccessSchema = z
  .object({ success: z.literal(true) })
  .openapi({ example: { success: true } });

const inboxAgentStateSchema = z.enum([
  "RegistrationRequested",
  "RegistrationInitiated",
  "RegistrationConfirmed",
  "RegistrationFailed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
]);

const inboxWalletIdentitySchema = z.object({
  walletVkey: z.string(),
  walletAddress: z.string(),
});

const inboxCurrentTransactionSchema = z.object({
  txHash: z.string().nullable(),
  status: z.enum([
    "Pending",
    "Confirmed",
    "FailedViaTimeout",
    "FailedViaManualReset",
    "RolledBack",
  ]),
  confirmations: z.number().nullable(),
  fees: z.string().nullable(),
  blockHeight: z.number().nullable(),
  blockTime: z.number().nullable(),
});

const inboxAgentItemSchema = z.object({
  error: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  agentSlug: z.string(),
  state: inboxAgentStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCheckedAt: z.string().nullable(),
  agentIdentifier: z.string().nullable(),
  metadataVersion: z.number(),
  sendFundingLovelace: z.string().nullable(),
  SmartContractWallet: inboxWalletIdentitySchema,
  RecipientWallet: inboxWalletIdentitySchema.nullable(),
  CurrentTransaction: inboxCurrentTransactionSchema.nullable(),
});

const inboxAgentsListSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.array(inboxAgentItemSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi({
    example: {
      success: true,
      nextCursor: "cm_inbox_2",
      data: [
        {
          id: "cm_inbox_1",
          name: "Support inbox",
          description: "Routes support requests into the Masumi inbox registry",
          agentSlug: "support-inbox",
          state: "RegistrationConfirmed",
          error: null,
          createdAt: "2026-04-10T10:00:00.000Z",
          updatedAt: "2026-04-10T10:10:00.000Z",
          lastCheckedAt: "2026-04-10T10:12:00.000Z",
          agentIdentifier: "policy.asset",
          metadataVersion: 1,
          sendFundingLovelace: null,
          SmartContractWallet: {
            walletVkey: "wallet_vkey_123",
            walletAddress: "addr_test1mint...",
          },
          RecipientWallet: {
            walletVkey: "wallet_vkey_456",
            walletAddress: "addr_test1recipient...",
          },
          CurrentTransaction: {
            txHash: "abc123",
            status: "Confirmed",
            confirmations: 12,
            fees: "170000",
            blockHeight: 123,
            blockTime: 1_744_277_200,
          },
        },
      ],
    },
  });

const inboxAgentMutationSuccessSchema = z
  .object({
    success: z.literal(true),
    data: inboxAgentItemSchema,
  })
  .openapi({
    example: {
      success: true,
      data: {
        id: "cm_inbox_1",
        name: "Support inbox",
        description: "Routes support requests into the Masumi inbox registry",
        agentSlug: "support-inbox",
        state: "RegistrationConfirmed",
        error: null,
        createdAt: "2026-04-10T10:00:00.000Z",
        updatedAt: "2026-04-10T10:10:00.000Z",
        lastCheckedAt: "2026-04-10T10:12:00.000Z",
        agentIdentifier: "policy.asset",
        metadataVersion: 1,
        sendFundingLovelace: null,
        SmartContractWallet: {
          walletVkey: "wallet_vkey_123",
          walletAddress: "addr_test1mint...",
        },
        RecipientWallet: {
          walletVkey: "wallet_vkey_456",
          walletAddress: "addr_test1recipient...",
        },
        CurrentTransaction: null,
      },
    },
  });

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
    data: agentListItemPublicSchema,
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

/** `contractJsonResponse` strips unknown keys; `.passthrough()` on `data` keeps server-only fields in JSON without documenting them in OpenAPI. */
const verificationChallengeSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z
      .object({
        challenge: z.string(),
        generatedAt: z.string().nullable(),
      })
      .passthrough()
      .openapi({
        description:
          "Challenge UUID and when it was issued. Responses may include additional authenticated-only fields not listed here.",
      }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        challenge: "550e8400-e29b-41d4-a716-446655440000",
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
    data: agentListItemPublicSchema,
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
  agentIdentifier: z.string().nullable(),
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
            agentIdentifier: "agent123policy456name789",
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
      /** `USD` when USDM/tUSDM withdrawn income exists in the period; otherwise `ADA`. */
      amountUnit: z.enum(["USD", "ADA"]),
      previousTotal: z.number().optional(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        earnings: [{ date: "2025-01-15", amount: 12.5 }],
        total: 12.5,
        amountUnit: "USD",
        previousTotal: 10,
      },
    },
  });

const credentialStatusValueSchema = z.enum([
  "PENDING",
  "ISSUED",
  "REVOKED",
  "EXPIRED",
]);

const issuedCredentialSummarySchema = z
  .object({
    id: z.string(),
    credentialId: z.string(),
    schemaSaid: z.string(),
    aid: z.string(),
    status: credentialStatusValueSchema,
    issuedAt: z.string(),
    expiresAt: z.string().nullable(),
  })
  .openapi({
    example: {
      id: "cred_123",
      credentialId: "pending-550e8400-e29b-41d4-a716-446655440000",
      schemaSaid: "EM0example_schema_said",
      aid: "EXAMPLE_AID",
      status: "PENDING",
      issuedAt: "2026-04-15T12:00:00.000Z",
      expiresAt: null,
    },
  });

const credentialCheckConnectionBodySchema = z
  .object({
    aid: z.string().min(1),
  })
  .openapi({
    example: {
      aid: "EXAMPLE_AID",
    },
  });

const credentialIssueBodySchema = z
  .object({
    aid: z.string().min(1),
    oobi: z.string().optional(),
    attributes: z.record(z.string(), z.any()).optional(),
    agentId: z.string().min(1),
    organizationId: z.string().optional(),
    expiresAt: z
      .string()
      .datetime({ offset: true })
      .openapi({
        format: "date-time",
        example: "2026-12-31T23:59:59.000Z",
      })
      .optional(),
  })
  .openapi({
    example: {
      aid: "EXAMPLE_AID",
      oobi: "http://veridian.example/oobi/aid/EXAMPLE_AID",
      agentId: "cmlf6gswz0000x1uctad958tq",
      attributes: {
        tier: "gold",
      },
    },
  });

const credentialCheckConnectionSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      exists: z.boolean(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: { exists: true },
    },
  });

const credentialIssueSuccessSchema = z
  .object({
    success: z.literal(true),
    data: issuedCredentialSummarySchema,
  })
  .openapi({
    example: {
      success: true,
      data: {
        id: "cred_123",
        credentialId: "pending-550e8400-e29b-41d4-a716-446655440000",
        schemaSaid: "EM0example_schema_said",
        aid: "EXAMPLE_AID",
        status: "PENDING",
        issuedAt: "2026-04-15T12:00:00.000Z",
        expiresAt: null,
      },
    },
  });

const credentialIssuerOobiSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      oobi: z.string(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: { oobi: "http://veridian.example/oobi/issuer" },
    },
  });

const credentialSchemaSaidSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      schemaSaid: z.string(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: { schemaSaid: "EM0example_schema_said" },
    },
  });

const credentialStatusSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.string(),
      credentialId: z.string().optional(),
      status: credentialStatusValueSchema,
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        id: "cred_123",
        credentialId: "pending-550e8400-e29b-41d4-a716-446655440000",
        status: "PENDING",
      },
    },
  });

const credentialReconcileSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      resolved: z.boolean(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: { resolved: true },
    },
  });

const activityTransactionSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      type: z.enum(["payment", "purchase"]),
      item: z.any().openapi({
        description:
          "Underlying payment-node transaction payload for the requested payment or purchase.",
      }),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        type: "payment",
        item: {
          id: "txn-1",
          status: "FundsLocked",
          txHash: "abc123",
        },
      },
    },
  });

const earningsAgentsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable(),
        agentIdentifier: z.string(),
        registrationState: z.string(),
        network: z.enum(["Mainnet", "Preprod"]),
      }),
    ),
  })
  .openapi({
    example: {
      success: true,
      data: [
        {
          id: "agent-1",
          name: "Alpha",
          icon: null,
          agentIdentifier: "agent-alpha",
          registrationState: "RegistrationConfirmed",
          network: "Preprod",
        },
      ],
    },
  });

const analyticsUnitAmountSchema = z.object({
  unit: z.string(),
  amount: z.number(),
});

const agentAnalyticsDisplaySchema = z.object({
  usdAmount: z.number(),
  adaAmount: z.number(),
  displayUnit: z.enum(["USD", "ADA"]),
  displayAmount: z.number(),
  hasMixedUnits: z.boolean(),
});

const agentAnalyticsSummarySchema = agentAnalyticsDisplaySchema.extend({
  units: z.array(analyticsUnitAmountSchema),
  blockchainFees: z.number(),
});

const agentAnalyticsSeriesPointSchema = agentAnalyticsDisplaySchema.extend({
  key: z.string(),
  label: z.string(),
  amount: z.number(),
  units: z.array(analyticsUnitAmountSchema),
  blockchainFees: z.number(),
});

const agentAnalyticsSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      agent: z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable(),
        agentIdentifier: z.string().nullable(),
        network: z.enum(["Mainnet", "Preprod"]),
      }),
      period: z.object({
        range: z.enum(["7d", "30d", "90d", "all", "custom"]),
        granularity: z.enum(["day", "month"]),
        startDate: z.string(),
        endDate: z.string(),
        periodStart: z.string().nullable(),
        periodEnd: z.string().nullable(),
        timeZone: z.string(),
      }),
      totalTransactions: z.number(),
      displayUnit: z.enum(["USD", "ADA"]),
      totals: z.object({
        income: agentAnalyticsSummarySchema,
        refunded: agentAnalyticsSummarySchema,
        pending: agentAnalyticsSummarySchema,
      }),
      series: z.object({
        income: z.array(agentAnalyticsSeriesPointSchema),
        refunded: z.array(agentAnalyticsSeriesPointSchema),
        pending: z.array(agentAnalyticsSeriesPointSchema),
      }),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        agent: {
          id: "agent-1",
          name: "Alpha",
          icon: null,
          agentIdentifier: "agent-alpha",
          network: "Preprod",
        },
        period: {
          range: "30d",
          granularity: "day",
          startDate: "2026-03-17",
          endDate: "2026-04-15",
          periodStart: "2026-03-17T00:00:00.000Z",
          periodEnd: "2026-04-15T23:59:59.000Z",
          timeZone: "Etc/UTC",
        },
        totalTransactions: 5,
        displayUnit: "USD",
        totals: {
          income: {
            usdAmount: 2.5,
            adaAmount: 0,
            displayUnit: "USD",
            displayAmount: 2.5,
            hasMixedUnits: false,
            units: [{ unit: "USDM", amount: 2500000 }],
            blockchainFees: 350000,
          },
          refunded: {
            usdAmount: 0,
            adaAmount: 0,
            displayUnit: "USD",
            displayAmount: 0,
            hasMixedUnits: false,
            units: [],
            blockchainFees: 0,
          },
          pending: {
            usdAmount: 0,
            adaAmount: 4,
            displayUnit: "ADA",
            displayAmount: 4,
            hasMixedUnits: false,
            units: [{ unit: "", amount: 4000000 }],
            blockchainFees: 0,
          },
        },
        series: {
          income: [
            {
              key: "2026-04-10",
              label: "Apr 10",
              amount: 1,
              usdAmount: 1,
              adaAmount: 0,
              displayUnit: "USD",
              displayAmount: 1,
              hasMixedUnits: false,
              units: [{ unit: "USDM", amount: 1000000 }],
              blockchainFees: 100000,
            },
          ],
          refunded: [],
          pending: [
            {
              key: "2026-04-11",
              label: "Apr 11",
              amount: 4,
              usdAmount: 0,
              adaAmount: 4,
              displayUnit: "ADA",
              displayAmount: 4,
              hasMixedUnits: false,
              units: [{ unit: "", amount: 4000000 }],
              blockchainFees: 0,
            },
          ],
        },
      },
    },
  });

const errBody = z.object({
  success: z.literal(false),
  error: z.string(),
});

const inboxAgentRegisterConflictBody = z
  .object({
    success: z.literal(false),
    error: z.enum([
      "Inbox slug is already in use on this network",
      "Inbox agent is already owned by another account",
    ]),
  })
  .openapi({
    example: {
      success: false,
      error: "Inbox slug is already in use on this network",
    },
  });

const insufficientCreditsSchema = z
  .object({
    success: z.literal(false),
    error: z.literal("Insufficient credits"),
    creditsRemaining: z.number(),
    requiredCredits: z.literal(1),
  })
  .openapi({
    example: {
      success: false,
      error: "Insufficient credits",
      creditsRemaining: 0,
      requiredCredits: 1,
    },
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

const insufficientCreditsResponse = {
  description: "Insufficient credits",
  content: { "application/json": { schema: insufficientCreditsSchema } },
} as const;

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

const creditsBalanceSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      creditsRemaining: z.number(),
      updatedAt: z.string(),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: {
        creditsRemaining: 20,
        updatedAt: "2026-04-13T10:30:00.000Z",
      },
    },
  });

// ── System ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/register/email",
  tags: ["Auth"],
  summary: "Register with email",
  description:
    "Creates a new account if needed, then sends a magic sign-in link to the provided email address. The client must confirm terms acceptance before calling this route.",
  security: noSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: registerByEmailApiBodySchema,
        },
      },
    },
  },
  responses: {
    202: okWithSchema(
      "Magic link accepted for delivery",
      registerByEmailApiSuccessSchema,
    ),
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errBody } },
    },
    429: {
      description: "Too many registration requests from this client",
      content: { "application/json": { schema: errBody } },
    },
    500: {
      description: "Registration email could not be queued or sent",
      content: { "application/json": { schema: errBody } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health",
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
  path: "/api/api-key-status",
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

registry.registerPath({
  method: "get",
  path: "/api/credits",
  tags: ["Credits"],
  summary: "Get remaining credits",
  description:
    "Canonical credits endpoint for the authenticated SaaS API. Returns the authenticated user’s remaining write credits.",
  security,
  responses: {
    200: okWithSchema("Current balance", creditsBalanceSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/credits",
  tags: ["Credits"],
  summary: "Get remaining credits",
  description:
    "Compatibility alias for `/api/credits`. Returns the authenticated user’s remaining write credits. New users start with 1 credit; existing users stay at 0 until credits are granted outside this v1 flow.",
  security,
  responses: {
    200: okWithSchema("Current balance", creditsBalanceSuccessSchema),
    ...stdResponses,
  },
});

// ── Agents ─────────────────────────────────────────────────────────────────

const verificationUnavailableResponse = {
  description:
    "Agent verification flows are temporarily disabled in this environment.",
  content: { "application/json": { schema: errBody } },
} as const;

registry.registerPath({
  method: "post",
  path: "/api/credentials/check-connection",
  tags: ["Credentials"],
  summary: "Check recipient AID connection",
  description:
    "Validates whether Veridian already knows the recipient AID before issuing a credential.",
  security,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: credentialCheckConnectionBodySchema,
        },
      },
    },
  },
  responses: {
    200: okWithSchema(
      "Recipient AID connection status",
      credentialCheckConnectionSuccessSchema,
    ),
    503: verificationUnavailableResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/credentials/issue",
  tags: ["Credentials"],
  summary: "Issue verification credential",
  description:
    "Requests a Veridian credential for an owned, registered agent after validating KYC, agent endpoint HMAC verification, and optional organization membership.",
  security,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: credentialIssueBodySchema,
        },
      },
    },
  },
  responses: {
    200: okWithSchema("Credential issued", credentialIssueSuccessSchema),
    503: verificationUnavailableResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/credentials/issuer-oobi",
  tags: ["Credentials"],
  summary: "Get issuer OOBI",
  description:
    "Returns the Veridian issuer OOBI that agents can resolve before credential issuance.",
  security,
  responses: {
    200: okWithSchema("Issuer OOBI", credentialIssuerOobiSuccessSchema),
    503: verificationUnavailableResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/credentials/reconcile",
  tags: ["Credentials"],
  summary: "Reconcile pending credentials",
  description:
    "Checks pending credentials for an owned agent and marks the first matching issued credential as resolved.",
  security,
  request: {
    query: credentialReconcileQuerySchema,
  },
  responses: {
    200: okWithSchema(
      "Credential reconciliation result",
      credentialReconcileSuccessSchema,
    ),
    503: verificationUnavailableResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/credentials/schema-said",
  tags: ["Credentials"],
  summary: "Get verification schema SAID",
  description:
    "Returns the configured Veridian schema SAID for agent verification credentials.",
  security,
  responses: {
    200: okWithSchema(
      "Verification schema SAID",
      credentialSchemaSaidSuccessSchema,
    ),
    503: verificationUnavailableResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/credentials/status",
  tags: ["Credentials"],
  summary: "Get credential status",
  description:
    "Polls the current credential state for a pending or issued verification credential owned by the caller.",
  security,
  request: {
    query: credentialStatusQuerySchema,
  },
  responses: {
    200: okWithSchema("Credential status", credentialStatusSuccessSchema),
    503: verificationUnavailableResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/agents",
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
  path: "/api/agents",
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
    402: insufficientCreditsResponse,
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/agents/{agentId}",
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
  path: "/api/agents/{agentId}",
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
  path: "/api/agents/counts",
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
  path: "/api/agents/{agentId}/transactions",
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
  path: "/api/agents/{agentId}/earnings",
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
  path: "/api/agents/{agentId}/verify",
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
  path: "/api/agents/{agentId}/verification-challenge",
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
  path: "/api/agents/{agentId}/verification-challenge",
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
  path: "/api/agents/{agentId}/test-verification-endpoint",
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
  path: "/api/agents/{agentId}/complete-registration",
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
        "Registration still pending (e.g. registry submission or blockchain confirmation); poll again shortly.",
      content: {
        "application/json": { schema: completeRegistrationPendingSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/agents/{agentId}/deregister",
  tags: ["Agents"],
  summary: "Deregister agent on-chain",
  security,
  request: { params: z.object({ agentId }) },
  responses: {
    200: okWithSchema("Deregistered", agentDeletedSuccessSchema),
    ...stdResponses,
  },
});

// ── Inbox agents ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/pay/api/v1/inbox-agents",
  tags: ["Inbox agents"],
  summary: "List inbox agents",
  description:
    "Paginated list of the authenticated user’s inbox-agent registrations. Effective `network` comes from the query param or the `payment_network` cookie.",
  servers: prefixedWrapperServers,
  security,
  request: {
    query: inboxAgentsListQuerySchema,
  },
  responses: {
    200: okWithSchema("Inbox-agent list", inboxAgentsListSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/pay/api/v1/inbox-agents",
  tags: ["Inbox agents"],
  summary: "Register inbox agent",
  description:
    "Registers a new inbox agent after normalizing the slug. A configured server-side executing wallet pays for the registration and receives the registration asset; ownership is tracked locally for the authenticated user.",
  servers: prefixedWrapperServers,
  security,
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerInboxAgentOpenApiBodySchema,
        },
      },
    },
  },
  responses: {
    200: okWithSchema(
      "Inbox-agent registration created",
      inboxAgentMutationSuccessSchema,
    ),
    402: insufficientCreditsResponse,
    409: {
      description:
        "Inbox registration conflict. Returned when the slug is already active or pending on the selected network, or when the finalized registration resolves to another user's existing ownership record.",
      content: {
        "application/json": { schema: inboxAgentRegisterConflictBody },
      },
    },
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/masumi/inbox-agent/register",
  tags: ["Inbox agents"],
  summary: "Register inbox agent",
  description:
    "Compatibility alias for `POST /pay/api/v1/inbox-agents`. Registers a new inbox agent with the same server-side executing-wallet flow as the canonical route.",
  security,
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerInboxAgentOpenApiBodySchema,
        },
      },
    },
  },
  responses: {
    200: okWithSchema(
      "Inbox-agent registration created",
      inboxAgentMutationSuccessSchema,
    ),
    402: insufficientCreditsResponse,
    409: {
      description:
        "Inbox registration conflict. Returned when the slug is already active or pending on the selected network, or when the finalized registration resolves to another user's existing ownership record.",
      content: {
        "application/json": { schema: inboxAgentRegisterConflictBody },
      },
    },
    ...stdResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/pay/api/v1/inbox-agents/{inboxAgentId}",
  tags: ["Inbox agents"],
  summary: "Delete inbox agent",
  description:
    "Deletes an inbox-agent registration after SaaS verifies it belongs to the caller and is in a user-safe terminal state.",
  servers: prefixedWrapperServers,
  security,
  request: {
    params: z.object({
      inboxAgentId: z.string().openapi({
        description: "Inbox agent request ID (CUID)",
        example: "cm_inbox_1",
      }),
    }),
  },
  responses: {
    200: okWithSchema("Deleted", inboxAgentMutationSuccessSchema),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/pay/api/v1/inbox-agents/{inboxAgentId}/deregister",
  tags: ["Inbox agents"],
  summary: "Deregister inbox agent",
  description:
    "Requests deregistration for a confirmed inbox agent after SaaS verifies ownership and resolves the matching payment source smart contract. The slug remains unavailable until the registry confirms deregistration.",
  servers: prefixedWrapperServers,
  security,
  request: {
    params: z.object({
      inboxAgentId: z.string().openapi({
        description: "Inbox agent request ID (CUID)",
        example: "cm_inbox_1",
      }),
    }),
  },
  responses: {
    200: okWithSchema(
      "Deregistration requested",
      inboxAgentMutationSuccessSchema,
    ),
    ...stdResponses,
  },
});

// ── Dashboard & activity ───────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/dashboard/overview",
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
  path: "/api/activity",
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
  path: "/api/earnings",
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

registry.registerPath({
  method: "get",
  path: "/api/activity/transaction",
  tags: ["Activity"],
  summary: "Get activity transaction",
  description:
    "Loads a single payment or purchase visible to the caller by ID and transaction type.",
  security,
  request: {
    query: activityTransactionQuerySchema,
  },
  responses: {
    200: okWithSchema("Transaction detail", activityTransactionSuccessSchema),
    503: {
      description:
        "Payment node is not configured or the active payment source is unavailable for the requested network.",
      content: { "application/json": { schema: errBody } },
    },
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/earnings/agent",
  tags: ["Earnings"],
  summary: "Get per-agent earnings analytics",
  description:
    "Returns earnings analytics, time-bucketed series, and display-unit totals for one owned agent on the selected network.",
  security,
  request: {
    query: agentAnalyticsQuerySchema,
  },
  responses: {
    200: okWithSchema(
      "Per-agent earnings analytics",
      agentAnalyticsSuccessSchema,
    ),
    ...stdResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/earnings/agents",
  tags: ["Earnings"],
  summary: "List agents eligible for earnings analytics",
  description:
    "Returns owned agents that have a payment identifier and a registration state eligible for earnings reporting.",
  security,
  request: {
    query: z.object({
      network: z.enum(["Mainnet", "Preprod"]).optional().openapi({
        description:
          "Target payment network. Defaults to `Preprod` when omitted.",
        example: "Preprod",
      }),
    }),
  },
  responses: {
    200: okWithSchema(
      "Agents eligible for earnings reporting",
      earningsAgentsSuccessSchema,
    ),
    ...stdResponses,
  },
});

type SaaSAppOpenAPISpec = ReturnType<
  InstanceType<typeof OpenApiGeneratorV3>["generateDocument"]
>;

/** Registry is fixed at module load; spec is immutable — compute once per process. */
let cachedSaaSAppOpenAPISpec: SaaSAppOpenAPISpec | undefined;

export function generateSaaSAppOpenAPISpec(): SaaSAppOpenAPISpec {
  if (cachedSaaSAppOpenAPISpec !== undefined) {
    return cachedSaaSAppOpenAPISpec;
  }
  cachedSaaSAppOpenAPISpec = injectProxyRoutesIntoOpenApiDocument(
    new OpenApiGeneratorV3(registry.definitions).generateDocument({
      openapi: "3.0.0",
      info: {
        version: "1.0.0",
        title: "Masumi SaaS API",
        description: [
          "HTTP API for Masumi SaaS (same origin as the web app). Authenticate with a session cookie or the x-api-key header (see API Keys in the app).",
        ].join("\n"),
      },
      servers: [{ url: "/", description: "This app" }],
      tags: [
        {
          name: "Auth",
          description: "Public registration and authentication bootstrap flows",
        },
        { name: "System", description: "Health and availability" },
        { name: "API keys", description: "Masumi SaaS API key introspection" },
        { name: "Credits", description: "Credit balances and compatibility" },
        {
          name: "Credentials",
          description: "Veridian credential issuance and polling",
        },
        { name: "Agents", description: "Your agents" },
        {
          name: "Inbox agents",
          description: "Managed inbox-agent registration flows",
        },
        { name: "Dashboard", description: "Overview and account data" },
        { name: "Activity", description: "What happened across your agents" },
        { name: "Earnings", description: "Earnings and payouts" },
      ],
    }),
  );
  return cachedSaaSAppOpenAPISpec;
}

export {
  activitySuccessSchema,
  activityTransactionSuccessSchema,
  agentAnalyticsSuccessSchema,
  agentCountsSuccessSchema,
  agentDeletedSuccessSchema,
  agentDetailSuccessSchema,
  agentEarningsSuccessSchema,
  agentsListSuccessSchema,
  agentTransactionsSuccessSchema,
  apiKeyStatusKeySchema,
  apiKeyStatusSessionSchema,
  completeRegistrationPendingSchema,
  completeRegistrationSuccessSchema,
  credentialCheckConnectionBodySchema,
  credentialCheckConnectionSuccessSchema,
  credentialIssueBodySchema,
  credentialIssuerOobiSuccessSchema,
  credentialIssueSuccessSchema,
  credentialReconcileSuccessSchema,
  credentialSchemaSaidSuccessSchema,
  credentialStatusSuccessSchema,
  creditsBalanceSuccessSchema,
  dashboardOverviewSuccessSchema,
  earningsAgentsSuccessSchema,
  errBody,
  errBodyWithOptionalDetails,
  healthServiceUnavailableSchema,
  healthSuccessSchema,
  inboxAgentMutationSuccessSchema,
  inboxAgentRegisterConflictBody,
  inboxAgentsListSuccessSchema,
  insufficientCreditsResponse,
  noSecurity,
  registerAgentOpenApiBodySchema,
  registerInboxAgentOpenApiBodySchema,
  security,
  startRegistrationSuccessSchema,
  stdResponses,
  testVerificationEndpointSuccessSchema,
  userEarningsSuccessSchema,
  verificationChallengePostBodySchema,
  verificationChallengeSuccessSchema,
  verificationUnavailableResponse,
  verifyAgentOpenApiBodySchema,
  verifyAgentSuccessSchema,
};
