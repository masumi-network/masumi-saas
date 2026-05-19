/**
 * Shared schemas + reusable OpenAPI fragments for the Masumi SaaS app API.
 *
 * Route registration lives with the per-route Hono apps (see
 * `src/server/hono/app.ts` and `src/app/api/**\/route.ts`). The OpenAPI
 * document is aggregated by `src/lib/openapi/aggregate-spec.ts`. This file
 * only exports the reusable Zod schemas and response fragments that those
 * routes import.
 */

import {
  registerAgentOpenApiBodySchema,
  verifyAgentBodySchema,
} from "@/lib/schemas/agent";
import { registerInboxAgentBodySchema } from "@/lib/schemas/inbox-agent";

import { z } from "./zod-openapi";

/** OpenAPI 3.0 security requirement entry (scheme name → scope list). */
type SecurityRequirementObject = Record<string, string[]>;

/** Documented auth for Try it out: `x-api-key` only. Browser session cookies still work same-origin but are not listed here. */
const security: SecurityRequirementObject[] = [{ apiKeyHeader: [] }];

/** Public operations (no API key in Try it out). */
const noSecurity: SecurityRequirementObject[] = [];

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

// ── Agents ─────────────────────────────────────────────────────────────────

const verificationUnavailableResponse = {
  description:
    "Agent verification flows are temporarily disabled in this environment.",
  content: { "application/json": { schema: errBody } },
} as const;

// ── Inbox agents ───────────────────────────────────────────────────────────

// ── Dashboard & activity ───────────────────────────────────────────────────

// `generateSaaSAppOpenAPISpec` lives in `./saas-app-openapi-generator.ts`
// — it now aggregates the spec from per-route Hono apps instead of from this
// module's (now no-op) registry.

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
