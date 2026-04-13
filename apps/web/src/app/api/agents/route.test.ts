import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const buildAgentPricingMock = vi.fn();
const startAgentRegistrationMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const shapeAgentWithMergedMetadataMock = vi.fn();
const agentFindFirstMock = vi.fn();

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

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: () => "agent-register:test",
}));

vi.mock("@/lib/api/agent-metadata", () => ({
  shapeAgentWithMergedMetadata: shapeAgentWithMergedMetadataMock,
}));

vi.mock("@/lib/schemas", () => ({
  parseNetwork: () => "Preprod",
}));

vi.mock("@/lib/schemas/agent", () => {
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
    agentsListQuerySchema: z.object({}).passthrough(),
    registerAgentBodySchema,
  };
});

describe("/api/agents POST", () => {
  let POST: typeof import("./route").POST;

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
    agentFindFirstMock.mockResolvedValue({
      id: "agent-1",
      name: "Research assistant",
      agentReference: null,
    });
    shapeAgentWithMergedMetadataMock.mockReturnValue({
      id: "agent-1",
      name: "Research assistant",
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
      },
    });
    expect(startAgentRegistrationMock).toHaveBeenCalledTimes(1);
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
