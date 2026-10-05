import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateAgentDetailsBodySchema } from "@/lib/schemas/agent";

vi.mock("server-only", () => ({}));

const agentFindFirstMock = vi.fn();
const agentUpdateManyMock = vi.fn();
const agentUpdateMock = vi.fn();
const agentReferenceUpdateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
      updateMany: agentUpdateManyMock,
      update: agentUpdateMock,
    },
    agentReference: {
      update: agentReferenceUpdateMock,
    },
    $transaction: transactionMock,
  },
}));

const tryCreateAdminPaymentNodeClientMock = vi.fn();
const getRegistryByIdMock = vi.fn();
const getRegistryByAgentIdentifierMock = vi.fn();
const updateAgentMock = vi.fn();

vi.mock("@/lib/payment-node/get-admin-client", () => ({
  tryCreateAdminPaymentNodeClient: tryCreateAdminPaymentNodeClientMock,
}));

vi.mock("@/lib/payment-node/config", () => ({
  paymentNodeConfig: {
    tryGetSmartContractAddress: vi.fn(() => "addr_test1wqsmartcontract"),
    getRegistryHoldingWalletFundingLovelace: vi.fn(() => "10000000"),
  },
}));

vi.mock("@/lib/payment-node/resolve-smart-contract", () => ({
  getSmartContractAddressForConfiguredSource: vi.fn(),
}));

vi.mock("@/lib/security/outbound-url", () => ({
  assertAllowedAgentApiUrl: vi.fn(
    async () => new URL("https://agent.example.com/mip"),
  ),
}));

const buildUpdateAgentInputMock = vi.fn();
vi.mock("@/lib/registry/build-update-agent-input", () => ({
  buildUpdateAgentInput: buildUpdateAgentInputMock,
}));

const { updateAgentDetails } = await import("./update-agent-details");

const V2_AGENT_IDENTIFIER = "a".repeat(56) + "b".repeat(64);
const REGISTRY_ID = "registry-entry-1";

function registeredAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    userId: "user-1",
    name: "Old name",
    description: "Old description",
    apiUrl: "https://old.example.com/mip",
    tags: ["old"],
    icon: "bot",
    metadata: null,
    agentIdentifier: V2_AGENT_IDENTIFIER,
    networkIdentifier: "Preprod",
    registrationState: "RegistrationConfirmed",
    updatedAt: new Date(),
    agentReference: {
      externalId: REGISTRY_ID,
      networkIdentifier: "Preprod",
      metadata: {
        smartContractAddress: "addr_test1wqsmartcontract",
        registrationPayload: {
          exampleOutputs: [],
          capabilityName: "Masumi",
          capabilityVersion: "1.0",
          authorName: "Author",
          agentPricing: { pricingType: "Free" },
        },
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  buildUpdateAgentInputMock.mockReturnValue({
    network: "Preprod",
    agentIdentifier: V2_AGENT_IDENTIFIER,
    name: "Old name",
    apiBaseUrl: "https://old.example.com/mip",
    description: "Old description",
    Tags: ["old"],
    ExampleOutputs: [],
    Capability: { name: "Masumi", version: "1.0" },
    Author: { name: "Author" },
    AgentPricing: { pricingType: "Free" },
    verifications: [],
  });
  tryCreateAdminPaymentNodeClientMock.mockReturnValue({
    getRegistryById: getRegistryByIdMock,
    getRegistryByAgentIdentifier: getRegistryByAgentIdentifierMock,
    updateAgent: updateAgentMock,
  });
  getRegistryByIdMock.mockResolvedValue({
    id: REGISTRY_ID,
    state: "RegistrationConfirmed",
    name: "Old name",
    apiBaseUrl: "https://old.example.com/mip",
    description: "Old description",
    Tags: ["old"],
    Capability: { name: "Masumi", version: "1.0" },
    Author: { name: "Author" },
    AgentPricing: { pricingType: "Free" },
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  getRegistryByAgentIdentifierMock.mockResolvedValue({
    Metadata: {
      name: "Old name",
      apiBaseUrl: "https://old.example.com/mip",
      description: "Old description",
      metadataVersion: 2,
      verifications: [],
    },
  });
  agentUpdateManyMock.mockResolvedValue({ count: 1 });
  updateAgentMock.mockResolvedValue(undefined);
  transactionMock.mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) {
      await op;
    }
  });
  agentUpdateMock.mockResolvedValue(undefined);
  agentReferenceUpdateMock.mockResolvedValue(undefined);
});

describe("updateAgentDetails", () => {
  it("returns error when agent is not registered", async () => {
    agentFindFirstMock.mockResolvedValue(null);

    const result = await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "New name",
        tags: "ai",
        apiUrl: "https://agent.example.com/mip",
      },
    });

    expect(result).toEqual({
      success: false,
      error: "Agent is not registered on the payment node",
    });
  });

  it("blocks in-flight update states", async () => {
    agentFindFirstMock.mockResolvedValue(
      registeredAgent({ registrationState: "UpdateInitiated" }),
    );

    const result = await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "New name",
        tags: "ai",
        apiUrl: "https://agent.example.com/mip",
      },
    });

    expect(result).toEqual({
      success: false,
      error: "An agent update is already in progress. Please try again later.",
    });
  });

  it("updates registry metadata and persists agent fields", async () => {
    agentFindFirstMock.mockResolvedValue(registeredAgent());

    const result = await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "New name",
        description: "New description",
        tags: "ai, research",
        apiUrl: "https://agent.example.com/mip",
        capabilityName: "Masumi",
        capabilityVersion: "2.0",
        icon: "bot",
      },
    });

    expect(result.success).toBe(true);
    expect(updateAgentMock).toHaveBeenCalledOnce();
    expect(updateAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sendFundingLovelace: "10000000",
      }),
    );
    expect(buildUpdateAgentInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verifications: [],
      }),
    );
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(agentUpdateMock).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      data: expect.objectContaining({
        name: "New name",
        registrationState: "UpdateRequested",
      }),
    });
  });

  it("continues edit when on-chain metadata parse returns 422", async () => {
    agentFindFirstMock.mockResolvedValue(registeredAgent());
    getRegistryByAgentIdentifierMock.mockRejectedValue(
      new Error("422: Agent metadata is invalid or malformed"),
    );

    const result = await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "New name",
        description: "New description",
        tags: "ai, research",
        apiUrl: "https://agent.example.com/mip",
        capabilityName: "Masumi",
        capabilityVersion: "2.0",
        icon: "bot",
      },
    });

    expect(result.success).toBe(true);
    expect(buildUpdateAgentInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onChainMetadata: expect.objectContaining({
          agentIdentifier: V2_AGENT_IDENTIFIER,
          Metadata: expect.objectContaining({
            name: "Old name",
            apiBaseUrl: "https://old.example.com/mip",
            metadataVersion: 2,
          }),
        }),
      }),
    );
    expect(updateAgentMock).toHaveBeenCalledOnce();
  });

  it("preserves the x402 manifest endpoint when the resource is unchanged", async () => {
    const resource = "https://paid.example.com/old";
    const manifestUrl =
      "https://saas.example.com/api/public/x402-manifest/agent-1";
    agentFindFirstMock.mockResolvedValue(
      registeredAgent({
        apiUrl: "https://paid.example.com/old",
        metadata: JSON.stringify({
          registryEntryType: "X402",
          x402Manifest: {
            x402Version: 2,
            resources: [
              {
                resource: "https://paid.example.com/old",
                type: "http",
                description: "Weather",
              },
            ],
          },
        }),
      }),
    );
    getRegistryByIdMock.mockResolvedValue({
      type: "X402",
      x402ResourcesUrl: manifestUrl,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    buildUpdateAgentInputMock.mockReturnValue({
      type: "X402",
      x402ResourcesUrl: manifestUrl,
      Capability: { name: "Masumi", version: "1" },
      Author: { name: "Author" },
    });
    await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: { name: "New name", apiUrl: resource, tags: "x402" },
    });
    expect(updateAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({ x402ResourcesUrl: manifestUrl }),
    );
    const metadata = JSON.parse(agentUpdateMock.mock.calls[0][0].data.metadata);
    expect(metadata.x402Manifest.resources).toEqual([
      { resource, type: "http", description: "Weather" },
    ]);
  });

  it("rejects an X402 resource URL change before requesting a registry update", async () => {
    agentFindFirstMock.mockResolvedValue(
      registeredAgent({ apiUrl: "https://paid.example.com/old" }),
    );
    getRegistryByIdMock.mockResolvedValue({ type: "X402" });

    const result = await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "New name",
        tags: "x402",
        apiUrl: "https://paid.example.com/new",
      },
    });

    expect(result).toEqual({
      success: false,
      error: "The resource URL of a registered x402 agent cannot be changed.",
    });
    expect(agentUpdateManyMock).not.toHaveBeenCalled();
    expect(agentReferenceUpdateMock).not.toHaveBeenCalled();
    expect(updateAgentMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("clears explicitly empty legal fields while preserving omitted fields", async () => {
    agentFindFirstMock.mockResolvedValue(
      registeredAgent({
        metadata: JSON.stringify({
          termsOfUseUrl: "https://example.com/terms",
          privacyPolicyUrl: "https://example.com/privacy",
        }),
      }),
    );
    buildUpdateAgentInputMock.mockReturnValue({
      Capability: { name: "Masumi", version: "1" },
      Author: { name: "Author" },
      Legal: {
        terms: "https://example.com/terms",
        privacyPolicy: "https://example.com/privacy",
      },
    });
    await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "Name",
        apiUrl: "https://agent.example.com",
        tags: "ai",
        termsOfUseUrl: "",
      },
    });
    expect(updateAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Legal: { privacyPolicy: "https://example.com/privacy" },
      }),
    );
    expect(JSON.parse(agentUpdateMock.mock.calls[0][0].data.metadata)).toEqual({
      privacyPolicyUrl: "https://example.com/privacy",
    });
  });

  it("sends empty Legal when all legal links are removed", async () => {
    agentFindFirstMock.mockResolvedValue(registeredAgent());
    buildUpdateAgentInputMock.mockReturnValue({
      Capability: { name: "Masumi", version: "1" },
      Author: { name: "Author" },
      Legal: { terms: "https://example.com/terms" },
    });
    await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "Name",
        apiUrl: "https://agent.example.com",
        tags: "ai",
        termsOfUseUrl: "",
        privacyPolicyUrl: "",
        otherUrl: "",
      },
    });
    expect(updateAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({ Legal: {} }),
    );
  });

  it("returns error when update lock cannot be acquired", async () => {
    agentFindFirstMock.mockResolvedValue(registeredAgent());
    agentUpdateManyMock.mockResolvedValue({ count: 0 });

    const result = await updateAgentDetails({
      userId: "user-1",
      agentId: "agent-1",
      body: {
        name: "New name",
        tags: "ai",
        apiUrl: "https://agent.example.com/mip",
      },
    });

    expect(result).toEqual({
      success: false,
      error: "An agent update is already in progress. Please try again later.",
    });
    expect(updateAgentMock).not.toHaveBeenCalled();
  });
});

describe("updateAgentDetailsBodySchema", () => {
  it("accepts editable registry fields", () => {
    const result = updateAgentDetailsBodySchema.safeParse({
      name: "Research assistant",
      description: "Helps with literature review",
      tags: "research, nlp",
      apiUrl: "https://agent.example.com/mip",
      capabilityName: "Masumi",
      capabilityVersion: "1.0",
      exampleOutputs: [
        {
          name: "Sample",
          url: "https://example.com/sample.json",
          mimeType: "application/json",
        },
      ],
      termsOfUseUrl: "https://example.com/terms",
      privacyPolicyUrl: "https://example.com/privacy",
      otherUrl: "",
      icon: "bot",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing tags", () => {
    const result = updateAgentDetailsBodySchema.safeParse({
      name: "Agent",
      tags: "",
      apiUrl: "https://agent.example.com/mip",
    });

    expect(result.success).toBe(false);
  });
});
