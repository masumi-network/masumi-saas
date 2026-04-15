import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "@/lib/zod-openapi";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const buildAgentPricingMock = vi.fn();
const startAgentRegistrationMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const shapeAgentWithMergedMetadataMock = vi.fn();
const agentFindFirstMock = vi.fn();
const listWalletOwnedAgentsForUserMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
    },
  },
  RegistrationState: {
    RegistrationRequested: "RegistrationRequested",
    RegistrationInitiated: "RegistrationInitiated",
    RegistrationConfirmed: "RegistrationConfirmed",
    RegistrationFailed: "RegistrationFailed",
  },
}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/agent-registration", () => ({
  buildAgentPricing: buildAgentPricingMock,
  startAgentRegistration: startAgentRegistrationMock,
}));

vi.mock("@/lib/agents/wallet-ownership", () => ({
  listWalletOwnedAgentsForUser: listWalletOwnedAgentsForUserMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: () => "agent-register:test",
}));

vi.mock("@/lib/api/agent-metadata", () => ({
  shapeAgentWithMergedMetadata: shapeAgentWithMergedMetadataMock,
}));

vi.mock("@/lib/schemas", () => ({
  parseNetwork: (value?: string) =>
    value === "Mainnet" ? "Mainnet" : "Preprod",
}));

vi.mock("@/lib/schemas/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/schemas/agent")>();
  const registerAgentBodySchema = z
    .object({
      name: z.string().min(1),
      description: z.string().optional().or(z.literal("")),
      extendedDescription: z.string().optional().or(z.literal("")),
      apiUrl: z.string().url(),
      tags: z.string().min(1),
      icon: z.string().optional().or(z.literal("")),
      pricing: z.any().optional(),
      termsOfUseUrl: z.string().optional().or(z.literal("")),
      privacyPolicyUrl: z.string().optional().or(z.literal("")),
      otherUrl: z.string().optional().or(z.literal("")),
      capabilityName: z.string().optional().or(z.literal("")),
      capabilityVersion: z.string().optional().or(z.literal("")),
      exampleOutputs: z.array(z.any()).optional(),
    })
    .strict();

  return {
    ...actual,
    agentsListQuerySchema: z.object({
      verificationStatus: z.string().optional(),
      unverified: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((value) => value === true || value === "true"),
      cursor: z.string().optional(),
      take: z.coerce.number().optional().default(20),
      registrationState: z.string().optional(),
      registrationStateIn: z.string().optional(),
      search: z.string().optional(),
    }),
    registerAgentBodySchema,
  };
});

describe("/api/agents POST", () => {
  let POST: typeof import("./route").POST;

  const agentResponseShape = {
    id: "agent-1",
    userId: "user-1",
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
    agentIdentifier: "policy.asset",
    networkIdentifier: "Preprod",
    pricing: {
      pricingType: "Fixed",
      prices: [{ amount: "5", currency: "USD" }],
    },
    createdAt: "2026-04-13T10:00:00.000Z",
    updatedAt: "2026-04-13T10:00:00.000Z",
    veridianCredentialId: null,
  } as const;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1", name: "Ada", email: "ada@example.com" },
      activeOrganizationId: null,
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    buildAgentPricingMock.mockReturnValue({
      pricingType: "Fixed",
      prices: [{ amount: "5", currency: "USD" }],
    });
    consumeCreditIfRequiredMock.mockResolvedValue({
      creditsRemaining: 0,
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    });
    startAgentRegistrationMock.mockResolvedValue({
      success: true,
      agentId: "agent-1",
    });
    listWalletOwnedAgentsForUserMock.mockResolvedValue([]);
    agentFindFirstMock.mockResolvedValue({
      ...agentResponseShape,
      agentReference: null,
    });
    shapeAgentWithMergedMetadataMock.mockReturnValue(agentResponseShape);
  });

  it("consumes one credit before starting registration", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Research assistant",
          description: "Helps with literature review",
          apiUrl: "https://agent.example.com/mip",
          tags: "research, nlp",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(consumeCreditIfRequiredMock).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "agent_register",
      reference: "agent-register:test",
      network: "Preprod",
      metadata: {
        name: "Research assistant",
        apiUrl: "https://agent.example.com/mip",
        network: "Preprod",
        authMethod: "session",
      },
    });
    expect(startAgentRegistrationMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when Mainnet payment-source config is missing", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    startAgentRegistrationMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Mainnet",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Research assistant",
          description: "Helps with literature review",
          apiUrl: "https://agent.example.com/mip",
          tags: "research, nlp",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });
  });

  it("lists only wallet-owned agents for the selected network", async () => {
    const GET = (await import("./route")).GET;
    listWalletOwnedAgentsForUserMock.mockResolvedValue([
      {
        ...agentResponseShape,
        id: "agent-1",
        name: "Visible confirmed agent",
        description: "shown",
        extendedDescription: null,
        apiUrl: "https://visible.example.com",
        tags: ["wallet"],
        verificationStatus: "VERIFIED",
        registrationState: "RegistrationConfirmed",
        networkIdentifier: "Preprod",
        agentReference: { externalId: "ext-1" },
      },
      {
        ...agentResponseShape,
        id: "agent-2",
        name: "Hidden pending agent",
        description: "shown if search matches",
        extendedDescription: null,
        apiUrl: "https://hidden.example.com",
        tags: ["other"],
        verificationStatus: "PENDING",
        registrationState: "RegistrationFailed",
        networkIdentifier: "Preprod",
        agentReference: { externalId: "ext-2" },
      },
    ]);

    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod&registrationState=RegistrationConfirmed&search=visible",
      {
        method: "GET",
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(listWalletOwnedAgentsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [
        expect.objectContaining({
          id: "agent-1",
          name: "Visible confirmed agent",
        }),
      ],
      nextCursor: null,
    });
  });

  it("returns 402 and does not start registration when credits are insufficient", async () => {
    consumeCreditIfRequiredMock.mockRejectedValue({
      name: "InsufficientCreditsError",
      message: "Insufficient credits",
      creditsRemaining: 0,
      requiredCredits: 1,
    });
    handleAuthErrorMock.mockImplementation((error) => {
      if ((error as { name?: string }).name === "InsufficientCreditsError") {
        return Response.json(
          {
            success: false,
            error: "Insufficient credits",
            creditsRemaining: 0,
            requiredCredits: 1,
          },
          { status: 402 },
        );
      }
      return null;
    });

    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Research assistant",
          description: "Helps with literature review",
          apiUrl: "https://agent.example.com/mip",
          tags: "research, nlp",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(402);
    expect(startAgentRegistrationMock).not.toHaveBeenCalled();
  });

  it("does not consume credits when validation fails locally", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Research assistant",
          apiUrl: "https://agent.example.com/mip",
          tags: "",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(startAgentRegistrationMock).not.toHaveBeenCalled();
  });
});
