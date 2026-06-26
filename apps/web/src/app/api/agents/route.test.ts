import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "@/lib/zod-openapi";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const buildAgentPricingMock = vi.fn();
const startAgentRegistrationMock = vi.fn();
const validateAgentRegistrationPaymentSourcesPreflightMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const shapeAgentForApiMock = vi.fn();
const loadSupportedPaymentSourcesMapMock = vi.fn();
const agentFindFirstMock = vi.fn();
const listWalletOwnedAgentsForUserMock = vi.fn();
const createIntegrationConnectionMock = vi.fn();
const decryptIntegrationConnectionSecretMock = vi.fn();
const getScopedIntegrationConnectionMock = vi.fn();
const langdockInputFieldsToMipSchemaMock = vi.fn();
const testLangdockAgentMock = vi.fn();
const getPublicMipAgentBaseUrlMock = vi.fn();

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
  validateAgentRegistrationPaymentSourcesPreflight:
    validateAgentRegistrationPaymentSourcesPreflightMock,
}));

vi.mock("@/lib/agents/wallet-ownership", () => ({
  listWalletOwnedAgentsForUser: listWalletOwnedAgentsForUserMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: () => "agent-register:test",
}));

vi.mock("@/lib/api/agent-metadata", () => ({
  shapeAgentForApi: shapeAgentForApiMock,
}));

vi.mock("@masumi/payment-source-x402/supported-payment-sources", () => ({
  loadSupportedPaymentSourcesMap: loadSupportedPaymentSourcesMapMock,
}));

vi.mock("@/lib/integrations/connections", () => ({
  createIntegrationConnection: createIntegrationConnectionMock,
  decryptIntegrationConnectionSecret: decryptIntegrationConnectionSecretMock,
  getScopedIntegrationConnection: getScopedIntegrationConnectionMock,
}));

vi.mock("@/lib/integrations/langdock", () => ({
  langdockInputFieldsToMipSchema: langdockInputFieldsToMipSchemaMock,
  testLangdockAgent: testLangdockAgentMock,
}));

vi.mock("@/lib/mip/public-url", () => ({
  getPublicMipAgentBaseUrl: getPublicMipAgentBaseUrlMock,
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
      apiUrl: z.string().url().optional(),
      runtimeProvider: z.enum(["DIRECT_MIP", "LANGDOCK"]).optional(),
      integrationConnectionId: z.string().optional(),
      langdockApiKey: z.string().optional(),
      langdockAgentId: z.string().optional(),
      langdockBaseUrl: z.string().url().optional().or(z.literal("")),
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
    registerAgentOpenApiBodySchema: registerAgentBodySchema.openapi({}),
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
    validateAgentRegistrationPaymentSourcesPreflightMock.mockResolvedValue({
      ok: true,
    });
    startAgentRegistrationMock.mockResolvedValue({
      success: true,
      agentId: "agent-1",
    });
    createIntegrationConnectionMock.mockResolvedValue({
      id: "connection-1",
      provider: "LANGDOCK",
    });
    decryptIntegrationConnectionSecretMock.mockResolvedValue("saved-ld-key");
    getScopedIntegrationConnectionMock.mockResolvedValue(null);
    langdockInputFieldsToMipSchemaMock.mockReturnValue({
      input_data: [{ id: "text", type: "textarea", name: "Prompt" }],
    });
    testLangdockAgentMock.mockResolvedValue({
      id: "ld-agent-1",
      name: "Langdock research bot",
      description: "Answers research questions",
      inputFields: [{ id: "text", type: "text" }],
    });
    getPublicMipAgentBaseUrlMock.mockImplementation(
      (agentId: string) => `https://saas.example.com/mip/agents/${agentId}`,
    );
    listWalletOwnedAgentsForUserMock.mockResolvedValue([]);
    agentFindFirstMock.mockResolvedValue({
      ...agentResponseShape,
      agentReference: null,
    });
    loadSupportedPaymentSourcesMapMock.mockResolvedValue(new Map());
    shapeAgentForApiMock.mockImplementation((agent, sources) => {
      const { agentReference: _ref, ...rest } = agent as {
        agentReference?: unknown;
      };
      return {
        ...agentResponseShape,
        ...rest,
        supportedPaymentSources: sources ?? null,
      };
    });
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
        runtimeProvider: "DIRECT_MIP",
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

  it("forwards Dynamic pricing through to buildAgentPricing", async () => {
    buildAgentPricingMock.mockReturnValue({ pricingType: "Dynamic" });

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
          pricing: { pricingType: "Dynamic" },
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(buildAgentPricingMock).toHaveBeenCalledWith("Preprod", {
      pricingType: "Dynamic",
    });
    expect(startAgentRegistrationMock).toHaveBeenCalledTimes(1);
    const params = startAgentRegistrationMock.mock.calls[0]?.[1];
    expect(params.agentPricing).toEqual({ pricingType: "Dynamic" });
  });

  it("requires apiUrl for direct MIP registrations before consuming credits", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeProvider: "DIRECT_MIP",
          name: "Research assistant",
          description: "Helps with literature review",
          tags: "research, nlp",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(startAgentRegistrationMock).not.toHaveBeenCalled();
  });

  it("validates a new Langdock connection and registers a generated MIP runtime URL", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeProvider: "LANGDOCK",
          name: "Research assistant",
          description: "Helps with literature review",
          tags: "research, nlp",
          langdockApiKey: "ld_test",
          langdockAgentId: "ld-agent-1",
          langdockBaseUrl: "https://langdock.example.com/api",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(testLangdockAgentMock).toHaveBeenCalledWith({
      apiKey: "ld_test",
      agentId: "ld-agent-1",
      baseUrl: "https://langdock.example.com/api",
    });
    expect(createIntegrationConnectionMock).toHaveBeenCalledWith({
      scope: { userId: "user-1", organizationId: null },
      provider: "LANGDOCK",
      name: "Langdock",
      secret: "ld_test",
      metadata: expect.objectContaining({
        baseUrl: "https://langdock.example.com/api",
        lastAgentId: "ld-agent-1",
      }),
    });
    const params = startAgentRegistrationMock.mock.calls[0]?.[1];
    expect(getPublicMipAgentBaseUrlMock).toHaveBeenCalledWith(params.id);
    expect(consumeCreditIfRequiredMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          apiUrl: `https://saas.example.com/mip/agents/${params.id}`,
          runtimeProvider: "LANGDOCK",
        }),
      }),
    );
    expect(params).toMatchObject({
      apiUrl: `https://saas.example.com/mip/agents/${params.id}`,
      runtimeProvider: "LANGDOCK",
      integrationConnectionId: "connection-1",
      providerConfig: {
        langdockAgentId: "ld-agent-1",
        langdockBaseUrl: "https://langdock.example.com/api",
        inputSchema: {
          input_data: [{ id: "text", type: "textarea", name: "Prompt" }],
        },
        hitl: true,
      },
    });
    expect(params.providerConfig).not.toHaveProperty("runtimeSignatureSecret");
  });

  it("uses saved Langdock connection credentials and base URL metadata", async () => {
    getScopedIntegrationConnectionMock.mockResolvedValue({
      id: "connection-1",
      provider: "LANGDOCK",
      encryptedSecret: "encrypted",
      metadata: { baseUrl: "https://saved.langdock.example.com" },
    });

    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeProvider: "LANGDOCK",
          name: "Research assistant",
          description: "Helps with literature review",
          tags: "research, nlp",
          integrationConnectionId: "connection-1",
          langdockAgentId: "ld-agent-1",
          langdockBaseUrl: "",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(decryptIntegrationConnectionSecretMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "connection-1" }),
    );
    expect(createIntegrationConnectionMock).not.toHaveBeenCalled();
    expect(testLangdockAgentMock).toHaveBeenCalledWith({
      apiKey: "saved-ld-key",
      agentId: "ld-agent-1",
      baseUrl: "https://saved.langdock.example.com",
    });
    const params = startAgentRegistrationMock.mock.calls[0]?.[1];
    expect(params.integrationConnectionId).toBe("connection-1");
    expect(params.providerConfig.langdockBaseUrl).toBe(
      "https://saved.langdock.example.com",
    );
  });

  it("does not consume credits when Langdock validation fails", async () => {
    testLangdockAgentMock.mockRejectedValueOnce(new Error("bad Langdock key"));

    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeProvider: "LANGDOCK",
          name: "Research assistant",
          description: "Helps with literature review",
          tags: "research, nlp",
          langdockApiKey: "bad",
          langdockAgentId: "ld-agent-1",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(createIntegrationConnectionMock).not.toHaveBeenCalled();
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

  it("rejects invalid supportedPaymentSources before registration starts", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Research assistant",
          apiUrl: "https://agent.example.com/mip",
          tags: "research, nlp",
          supportedPaymentSources: [
            {
              chain: "EVM",
              network: "not-caip2",
              scheme: "Exact",
              asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              amount: "10000",
              decimals: 6,
              payTo: "0x1111111111111111111111111111111111111111",
            },
          ],
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(startAgentRegistrationMock).not.toHaveBeenCalled();
  });

  it("rejects x402 payment options for Free pricing", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Free research assistant",
          apiUrl: "https://agent.example.com/mip",
          tags: "research, nlp",
          pricing: { pricingType: "Free" },
          supportedPaymentSources: [
            {
              chain: "EVM",
              network: "eip155:84532",
              scheme: "Exact",
              asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              amount: "10000",
              decimals: 6,
              payTo: "0x1111111111111111111111111111111111111111",
            },
          ],
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(startAgentRegistrationMock).not.toHaveBeenCalled();
  });
});
