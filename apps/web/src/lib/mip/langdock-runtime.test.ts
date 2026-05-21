import { beforeEach, describe, expect, it, vi } from "vitest";

const agentFindUniqueMock = vi.fn();
const mipJobCreateMock = vi.fn();
const mipJobFindFirstMock = vi.fn();
const mipJobFindUniqueMock = vi.fn();
const mipJobUpdateMock = vi.fn();
const mipJobUpdateManyMock = vi.fn();
const completeLangdockChatMock = vi.fn();
const decryptIntegrationConnectionSecretMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findUnique: agentFindUniqueMock,
    },
    mipJob: {
      create: mipJobCreateMock,
      findFirst: mipJobFindFirstMock,
      findUnique: mipJobFindUniqueMock,
      update: mipJobUpdateMock,
      updateMany: mipJobUpdateManyMock,
    },
  },
}));

vi.mock("@/lib/integrations/connections", () => ({
  decryptIntegrationConnectionSecret: decryptIntegrationConnectionSecretMock,
}));

vi.mock("@/lib/integrations/langdock", () => ({
  completeLangdockChat: completeLangdockChatMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

const {
  getLangdockJobStatus,
  provideLangdockJobInput,
  resumeLangdockJob,
  startLangdockJob,
} = await import("./langdock-runtime");
const { getLangdockHitlInputSchema } = await import("./input-schema");
const { hashInputData, hashInputSchema } = await import("./hash");

function runtimeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    userId: "user-1",
    runtimeProvider: "LANGDOCK",
    agentIdentifier: "policy.asset",
    networkIdentifier: "Preprod",
    integrationConnection: { encryptedSecret: "encrypted-secret" },
    agentReference: { sellingWalletVkey: "seller-vkey" },
    providerConfig: {
      langdockAgentId: "ld-agent-1",
      langdockBaseUrl: "https://langdock.example.com",
      hitl: true,
    },
    ...overrides,
  };
}

describe("Langdock MIP runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decryptIntegrationConnectionSecretMock.mockResolvedValue("ld-key");
    completeLangdockChatMock.mockResolvedValue("Langdock answer");
    agentFindUniqueMock.mockResolvedValue(runtimeAgent());
    mipJobUpdateManyMock.mockResolvedValue({ count: 1 });
    mipJobFindUniqueMock.mockResolvedValue(null);
  });

  it("does not resume a job before proving it belongs to the route agent", async () => {
    mipJobFindFirstMock.mockResolvedValueOnce(null);

    const result = await getLangdockJobStatus("route-agent", {
      job_id: "other-agent-job",
    });

    expect(result).toStrictEqual({
      status: 404,
      body: { error: "Job not found" },
    });
    expect(mipJobFindUniqueMock).not.toHaveBeenCalled();
    expect(completeLangdockChatMock).not.toHaveBeenCalled();
  });

  it("moves a locked paid job into awaiting input and stores the Langdock reply", async () => {
    const paymentClient = {
      resolvePaymentByBlockchainIdentifier: vi
        .fn()
        .mockResolvedValue({ onChainState: "FundsLocked" }),
    };
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);
    mipJobFindUniqueMock
      .mockResolvedValueOnce({
        id: "job-1",
        agentId: "agent-1",
        status: "AWAITING_PAYMENT",
        blockchainIdentifier: "chain-1",
        agent: runtimeAgent(),
      })
      .mockResolvedValueOnce({
        id: "job-1",
        status: "RUNNING",
        inputData: { text: "Summarize this" },
      });

    await resumeLangdockJob("job-1");

    expect(
      paymentClient.resolvePaymentByBlockchainIdentifier,
    ).toHaveBeenCalledWith({
      blockchainIdentifier: "chain-1",
      network: "Preprod",
      includeHistory: false,
    });
    expect(mipJobUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "job-1", status: "AWAITING_PAYMENT" },
      data: { status: "RUNNING" },
    });
    expect(completeLangdockChatMock).toHaveBeenCalledWith({
      apiKey: "ld-key",
      agentId: "ld-agent-1",
      baseUrl: "https://langdock.example.com",
      messages: [{ role: "user", content: "Summarize this" }],
    });
    expect(mipJobUpdateMock).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "AWAITING_INPUT",
        result: "Langdock answer",
        inputSchema: getLangdockHitlInputSchema(),
        conversation: [
          { role: "user", content: "Summarize this" },
          { role: "assistant", content: "Langdock answer" },
        ],
      },
    });
  });

  it("does not run Langdock when another request already claimed the job", async () => {
    const paymentClient = {
      resolvePaymentByBlockchainIdentifier: vi
        .fn()
        .mockResolvedValue({ onChainState: "FundsLocked" }),
    };
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);
    mipJobUpdateManyMock.mockResolvedValue({ count: 0 });
    mipJobFindUniqueMock.mockResolvedValueOnce({
      id: "job-1",
      agentId: "agent-1",
      status: "AWAITING_PAYMENT",
      blockchainIdentifier: "chain-1",
      agent: runtimeAgent(),
    });

    await resumeLangdockJob("job-1");

    expect(mipJobUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "job-1", status: "AWAITING_PAYMENT" },
      data: { status: "RUNNING" },
    });
    expect(completeLangdockChatMock).not.toHaveBeenCalled();
  });

  it("creates a paid job with a payment-node payment request", async () => {
    const paymentClient = {
      createPayment: vi.fn().mockResolvedValue({
        blockchainIdentifier: "chain-1",
        payByTime: "2026-05-21T06:00:00.000Z",
        submitResultTime: "2026-05-21T07:00:00.000Z",
        unlockTime: "2026-05-21T08:00:00.000Z",
        externalDisputeUnlockTime: "2026-05-21T09:00:00.000Z",
        SmartContractWallet: { walletVkey: "payment-vkey" },
      }),
    };
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);
    mipJobCreateMock.mockResolvedValue({
      id: "job-1",
      sellerVKey: "seller-vkey",
    });

    const result = await startLangdockJob("agent-1", {
      identifierFromPurchaser: "buyer-1",
      input_data: { text: "Write a brief" },
    });

    const expectedInputHash = hashInputData(
      { text: "Write a brief" },
      "buyer-1",
    );
    expect(paymentClient.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        inputHash: expectedInputHash,
        network: "Preprod",
        agentIdentifier: "policy.asset",
        identifierFromPurchaser: "buyer-1",
        metadata: JSON.stringify({ agentId: "agent-1" }),
      }),
    );
    expect(mipJobCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: "agent-1",
        status: "AWAITING_PAYMENT",
        identifierFromPurchaser: "buyer-1",
        inputHash: expectedInputHash,
        blockchainIdentifier: "chain-1",
        agentIdentifier: "policy.asset",
        sellerVKey: "seller-vkey",
      }),
    });
    expect(result).toMatchObject({
      status: 200,
      body: {
        id: "job-1",
        input_hash: expectedInputHash,
        identifierFromPurchaser: "buyer-1",
        blockchainIdentifier: "chain-1",
        agentIdentifier: "policy.asset",
        sellerVKey: "seller-vkey",
      },
    });
  });

  it("continues HITL conversation until the purchaser finishes the job", async () => {
    const paymentClient = {
      submitPaymentResult: vi.fn().mockResolvedValue({}),
    };
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);
    const inputSchema = getLangdockHitlInputSchema();
    mipJobFindFirstMock.mockResolvedValue({
      id: "job-1",
      agentId: "agent-1",
      status: "AWAITING_INPUT",
      identifierFromPurchaser: "buyer-1",
      inputSchema,
      conversation: [
        { role: "user", content: "Initial prompt" },
        { role: "assistant", content: "First answer" },
      ],
      blockchainIdentifier: "chain-1",
      agent: runtimeAgent(),
    });

    const result = await provideLangdockJobInput("agent-1", {
      job_id: "job-1",
      input_schema_hash: hashInputSchema(inputSchema),
      input_data: { message: "finish" },
    });

    expect(paymentClient.submitPaymentResult).toHaveBeenCalledWith({
      network: "Preprod",
      blockchainIdentifier: "chain-1",
      submitResultHash: expect.any(String),
    });
    expect(mipJobUpdateMock).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "COMPLETED",
        result: [
          "user: Initial prompt",
          "assistant: First answer",
          "user: finish",
        ].join("\n\n"),
        outputHash: expect.any(String),
      }),
    });
    expect(result).toMatchObject({
      status: 200,
      body: {
        status: "completed",
        job_id: "job-1",
        output_hash: expect.any(String),
      },
    });
    expect((result.body as { signature?: string }).signature).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("does not complete paid jobs when result submission cannot be authenticated", async () => {
    getPaymentNodeClientForUserMock.mockResolvedValue(null);
    const inputSchema = getLangdockHitlInputSchema();
    mipJobFindFirstMock.mockResolvedValue({
      id: "job-1",
      agentId: "agent-1",
      status: "AWAITING_INPUT",
      identifierFromPurchaser: "buyer-1",
      inputSchema,
      conversation: [
        { role: "user", content: "Initial prompt" },
        { role: "assistant", content: "First answer" },
      ],
      blockchainIdentifier: "chain-1",
      agent: runtimeAgent(),
    });

    const result = await provideLangdockJobInput("agent-1", {
      job_id: "job-1",
      input_schema_hash: hashInputSchema(inputSchema),
      input_data: { message: "finish" },
    });

    expect(result).toStrictEqual({
      status: 503,
      body: { error: "Payment node unavailable" },
    });
    expect(mipJobUpdateMock).not.toHaveBeenCalled();
  });

  it("does not complete paid jobs when payment result submission fails", async () => {
    const paymentClient = {
      submitPaymentResult: vi.fn().mockRejectedValue(new Error("node down")),
    };
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);
    const inputSchema = getLangdockHitlInputSchema();
    mipJobFindFirstMock.mockResolvedValue({
      id: "job-1",
      agentId: "agent-1",
      status: "AWAITING_INPUT",
      identifierFromPurchaser: "buyer-1",
      inputSchema,
      conversation: [
        { role: "user", content: "Initial prompt" },
        { role: "assistant", content: "First answer" },
      ],
      blockchainIdentifier: "chain-1",
      agent: runtimeAgent(),
    });

    const result = await provideLangdockJobInput("agent-1", {
      job_id: "job-1",
      input_schema_hash: hashInputSchema(inputSchema),
      input_data: { message: "finish" },
    });

    expect(paymentClient.submitPaymentResult).toHaveBeenCalledWith({
      network: "Preprod",
      blockchainIdentifier: "chain-1",
      submitResultHash: expect.any(String),
    });
    expect(result).toStrictEqual({
      status: 502,
      body: { error: "Failed to submit payment result" },
    });
    expect(mipJobUpdateMock).not.toHaveBeenCalled();
  });
});
