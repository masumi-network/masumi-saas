import { beforeEach, describe, expect, it, vi } from "vitest";

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const mocks = vi.hoisted(() => {
  type MockFn = ReturnType<typeof vi.fn>;
  return {
    mockSupportedPaymentSourceFindUnique: vi.fn() as MockFn,
    mockX402NetworkFindFirst: vi.fn() as MockFn,
    mockX402SettlementFindUnique: vi.fn() as MockFn,
    mockX402SettlementUpsert: vi.fn() as MockFn,
    mockX402PaymentAttemptCreate: vi.fn() as MockFn,
    mockX402PaymentAttemptUpdate: vi.fn() as MockFn,
    mockX402EvmWalletFindFirst: vi.fn() as MockFn,
    mockOrgApiKeyFindUnique: vi.fn() as MockFn,
    mockX402EvmWalletCreate: vi.fn() as MockFn,
    mockBudgetFindFirst: vi.fn() as MockFn,
    mockBudgetUpdateMany: vi.fn() as MockFn,
    mockBudgetUpdate: vi.fn() as MockFn,
    mockBudgetUpsert: vi.fn() as MockFn,
    mockTxPaymentAttemptCreate: vi.fn() as MockFn,
    mockPrismaTransaction: vi.fn() as MockFn,
    mockFacilitatorVerify: vi.fn() as MockFn,
    mockFacilitatorSettle: vi.fn() as MockFn,
    mockExtractAndValidatePaymentIdentifier: vi.fn() as MockFn,
    mockEncodePaymentSignatureHeader: vi.fn() as MockFn,
    mockCreatePaymentPayload: vi.fn() as MockFn,
    latestClient: null as MockX402Client | null,
  };
});

type MockX402Client = {
  policies: Array<(version: number, requirements: unknown[]) => unknown[]>;
  extensions: unknown[];
  registerPolicy: (
    policy: (version: number, requirements: unknown[]) => unknown[],
  ) => MockX402Client;
  registerExtension: (extension: unknown) => MockX402Client;
  createPaymentPayload: (paymentRequired: unknown) => Promise<unknown>;
};

class X402ClientMock implements MockX402Client {
  policies: Array<(version: number, requirements: unknown[]) => unknown[]> = [];
  extensions: unknown[] = [];

  constructor() {
    mocks.latestClient = this;
  }

  registerPolicy(
    policy: (version: number, requirements: unknown[]) => unknown[],
  ) {
    this.policies.push(policy);
    return this;
  }

  registerExtension(extension: unknown) {
    this.extensions.push(extension);
    return this;
  }

  async createPaymentPayload(paymentRequired: unknown) {
    return mocks.mockCreatePaymentPayload(paymentRequired);
  }
}

vi.mock("@masumi/database/client", () => ({
  default: {
    supportedPaymentSource: {
      findUnique: mocks.mockSupportedPaymentSourceFindUnique,
    },
    x402Network: {
      findFirst: mocks.mockX402NetworkFindFirst,
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    orgApiKey: {
      findUnique: mocks.mockOrgApiKeyFindUnique,
    },
    x402Settlement: {
      findUnique: mocks.mockX402SettlementFindUnique,
      upsert: mocks.mockX402SettlementUpsert,
    },
    x402PaymentAttempt: {
      create: mocks.mockX402PaymentAttemptCreate,
      update: mocks.mockX402PaymentAttemptUpdate,
    },
    x402EvmWallet: {
      findFirst: mocks.mockX402EvmWalletFindFirst,
      create: mocks.mockX402EvmWalletCreate,
      findMany: vi.fn(),
    },
    x402WalletBudget: {
      findFirst: mocks.mockBudgetFindFirst,
      update: mocks.mockBudgetUpdate,
      upsert: mocks.mockBudgetUpsert,
      findMany: vi.fn(),
    },
    $transaction: mocks.mockPrismaTransaction,
  },
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
  X402EvmWalletType: {
    Purchasing: "Purchasing",
    Selling: "Selling",
  },
  X402PaymentDirection: {
    InboundVerify: "InboundVerify",
    InboundSettle: "InboundSettle",
    OutboundPayment: "OutboundPayment",
  },
  X402PaymentScheme: {
    Exact: "Exact",
  },
  X402PaymentStatus: {
    PaymentRequired: "PaymentRequired",
    Verified: "Verified",
    Settled: "Settled",
    Failed: "Failed",
    Replayed: "Replayed",
  },
}));

vi.mock("./encryption.js", () => ({
  decrypt: vi.fn(
    () => "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

vi.mock("@x402/core/client", () => ({
  x402Client: X402ClientMock,
}));

vi.mock("@x402/core/facilitator", () => ({
  x402Facilitator: class X402FacilitatorMock {
    verify = mocks.mockFacilitatorVerify;
    settle = mocks.mockFacilitatorSettle;
  },
}));

vi.mock("@x402/core/http", () => ({
  encodePaymentSignatureHeader: mocks.mockEncodePaymentSignatureHeader,
}));

vi.mock("@x402/evm", () => ({
  toClientEvmSigner: vi.fn(() => ({ signer: "client-signer" })),
  toFacilitatorEvmSigner: vi.fn(() => ({ signer: "facilitator-signer" })),
}));

vi.mock("@x402/evm/exact/client", () => ({
  registerExactEvmScheme: vi.fn(),
}));

vi.mock("@x402/evm/exact/facilitator", () => ({
  registerExactEvmScheme: vi.fn(),
}));

vi.mock("@x402/extensions/payment-identifier", () => ({
  PAYMENT_IDENTIFIER: "payment-identifier",
  appendPaymentIdentifierToExtensions: vi.fn(
    (extensions: Record<string, unknown>, id: string) => ({
      ...extensions,
      "payment-identifier": id,
    }),
  ),
  extractAndValidatePaymentIdentifier:
    mocks.mockExtractAndValidatePaymentIdentifier,
}));

vi.mock("viem", () => ({
  createPublicClient: vi.fn((opts: { chain?: { id?: number } }) => ({
    publicClient: true,
    getChainId: vi.fn(async () => opts?.chain?.id),
  })),
  createWalletClient: vi.fn((opts: { chain?: { id?: number } }) => ({
    extend: vi.fn(() => ({
      walletClient: true,
      getChainId: vi.fn(async () => opts?.chain?.id),
    })),
  })),
  defineChain: vi.fn((chain: unknown) => chain),
  http: vi.fn((rpcUrl: string) => ({ rpcUrl })),
  publicActions: {},
}));

vi.mock("viem/accounts", () => ({
  generatePrivateKey: vi.fn(
    () => "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ),
  privateKeyToAccount: vi.fn(() => ({
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  })),
}));

const USER_ID = "user-1";
const ORG_API_KEY_ID = "org-api-key-1";

const source = {
  id: "source-1",
  chain: "EVM",
  network: "eip155:84532",
  scheme: "Exact",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: 10_000n,
  decimals: 6,
  payTo: "0x1111111111111111111111111111111111111111",
  resource: "https://agent.example/run",
  extra: null,
  agentId: "agent-1",
  agent: {
    id: "agent-1",
    apiUrl: "https://agent.example",
    agentIdentifier: "agent-1",
    userId: USER_ID,
    organizationId: null,
  },
};

const networkRow = {
  id: "network-1",
  userId: USER_ID,
  caip2Id: source.network,
  displayName: "Base Sepolia",
  rpcUrl: "https://sepolia.base.org",
  isEnabled: true,
  FacilitatorWallet: {
    id: "wallet-facilitator",
    type: "Selling",
    encryptedPrivateKey: "encrypted-private-key",
    deletedAt: null,
  },
};

const requirements = {
  scheme: "exact",
  network: source.network,
  asset: source.asset,
  amount: source.amount.toString(),
  payTo: source.payTo,
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "permit2",
    decimals: source.decimals,
  },
};

const paymentPayload = {
  x402Version: 2,
  resource: { url: "https://agent.example/run" },
  accepted: requirements,
  payload: {
    signature: "0xabc",
    authorization: { nonce: "0x01", value: requirements.amount },
  },
};

const paymentRequired = {
  x402Version: 2,
  resource: { url: "https://agent.example/run" },
  accepts: [requirements],
};

function resetDefaultMocks() {
  mocks.latestClient = null;
  mocks.mockSupportedPaymentSourceFindUnique.mockResolvedValue(source);
  mocks.mockX402NetworkFindFirst.mockResolvedValue(networkRow);
  mocks.mockX402EvmWalletFindFirst.mockResolvedValue({
    id: "wallet-1",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    type: "Purchasing",
    encryptedPrivateKey: "encrypted-private-key",
    deletedAt: null,
  });
  mocks.mockOrgApiKeyFindUnique.mockResolvedValue({
    id: ORG_API_KEY_ID,
    organizationId: null,
  });
  mocks.mockX402EvmWalletCreate.mockResolvedValue({
    id: "wallet-new",
    address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    type: "Purchasing",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByUserId: USER_ID,
  });
  mocks.mockX402SettlementFindUnique.mockResolvedValue(null);
  mocks.mockX402SettlementUpsert.mockResolvedValue({ id: "settlement-1" });
  mocks.mockX402PaymentAttemptCreate.mockResolvedValue({ id: "attempt-1" });
  mocks.mockX402PaymentAttemptUpdate.mockResolvedValue({ id: "attempt-1" });
  mocks.mockFacilitatorVerify.mockResolvedValue({
    isValid: true,
    payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  mocks.mockFacilitatorSettle.mockResolvedValue({
    success: true,
    transaction: "0xsettlement",
    network: source.network,
    amount: requirements.amount,
    payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  mocks.mockExtractAndValidatePaymentIdentifier.mockReturnValue({
    id: null,
    validation: { valid: true },
  });
  mocks.mockEncodePaymentSignatureHeader.mockReturnValue(
    "x-payment-header-base64",
  );
  mocks.mockCreatePaymentPayload.mockResolvedValue(paymentPayload);
  mocks.mockBudgetFindFirst.mockResolvedValue({ id: "budget-1" });
  mocks.mockBudgetUpdateMany.mockResolvedValue({ count: 1 });
  mocks.mockBudgetUpdate.mockResolvedValue({ id: "budget-1" });
  mocks.mockBudgetUpsert.mockResolvedValue({
    id: "budget-1",
    orgApiKeyId: ORG_API_KEY_ID,
    evmWalletId: "wallet-1",
    caip2Network: source.network,
    asset: source.asset.toLowerCase(),
    remainingAmount: 100n,
    spentAmount: 0n,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  mocks.mockTxPaymentAttemptCreate.mockResolvedValue({
    id: "attempt-outbound-1",
  });
  mocks.mockPrismaTransaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        x402WalletBudget: {
          findFirst: mocks.mockBudgetFindFirst,
          updateMany: mocks.mockBudgetUpdateMany,
        },
        x402PaymentAttempt: {
          create: mocks.mockTxPaymentAttemptCreate,
        },
      }),
  );
}

describe("x402 service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultMocks();
  });

  it("hashes canonical payment payload JSON independent of object key order", async () => {
    const { hashX402PaymentPayload } = await import("./service.js");
    const first = {
      x402Version: 2,
      accepted: requirements,
      payload: paymentPayload.payload,
    };
    const second = {
      payload: {
        authorization: { value: requirements.amount, nonce: "0x01" },
        signature: "0xabc",
      },
      accepted: {
        payTo: source.payTo,
        amount: requirements.amount,
        asset: source.asset,
        network: source.network,
        scheme: "exact",
        maxTimeoutSeconds: 300,
        extra: {
          decimals: source.decimals,
          assetTransferMethod: "permit2",
        },
      },
      x402Version: 2,
    };

    expect(hashX402PaymentPayload(first)).toBe(hashX402PaymentPayload(second));
  });

  it("rejects settle when the API key is not allowed on the registered chain", async () => {
    const { settleX402Payment } = await import("./service.js");
    await expect(
      settleX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: ["eip155:1"],
        supportedPaymentSourceId: source.id,
        paymentPayload: paymentPayload as never,
      }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(mocks.mockFacilitatorSettle).not.toHaveBeenCalled();
  });

  it("deduplicates settle replays by canonical payment payload hash bound to the same source", async () => {
    const { settleX402Payment, hashX402PaymentPayload } =
      await import("./service.js");
    const paymentPayloadHash = hashX402PaymentPayload(paymentPayload);
    mocks.mockX402SettlementFindUnique.mockResolvedValue({
      id: "settlement-1",
      paymentPayloadHash,
      txHash: "0xsettled",
      caip2Network: source.network,
      amount: source.amount,
      payer: null,
      PaymentAttempt: {
        id: "attempt-original",
        payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        supportedPaymentSourceId: source.id,
        userId: USER_ID,
      },
    });
    mocks.mockX402PaymentAttemptCreate.mockResolvedValue({
      id: "attempt-replay",
    });

    const result = await settleX402Payment({
      userId: USER_ID,
      orgApiKeyId: ORG_API_KEY_ID,
      caip2NetworkLimit: [source.network],
      supportedPaymentSourceId: source.id,
      paymentPayload: paymentPayload as never,
    });

    expect(result).toMatchObject({
      attemptId: "attempt-replay",
      paymentPayloadHash,
      replay: true,
      settleResponse: {
        success: true,
        transaction: "0xsettled",
        network: source.network,
        amount: source.amount.toString(),
        payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    });
    expect(mocks.mockFacilitatorSettle).not.toHaveBeenCalled();
    expect(mocks.mockX402PaymentAttemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "Replayed",
          paymentPayloadHash,
        }),
      }),
    );
  });

  it("rejects a settle replay whose prior settlement belongs to a different source", async () => {
    const { settleX402Payment, hashX402PaymentPayload } =
      await import("./service.js");
    const paymentPayloadHash = hashX402PaymentPayload(paymentPayload);
    mocks.mockX402SettlementFindUnique.mockResolvedValue({
      id: "settlement-1",
      paymentPayloadHash,
      txHash: "0xsettled",
      caip2Network: source.network,
      amount: source.amount,
      payer: null,
      PaymentAttempt: {
        id: "attempt-original",
        payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        supportedPaymentSourceId: "a-different-source",
        userId: USER_ID,
      },
    });

    await expect(
      settleX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: [source.network],
        supportedPaymentSourceId: source.id,
        paymentPayload: paymentPayload as never,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.mockFacilitatorSettle).not.toHaveBeenCalled();
    expect(mocks.mockX402PaymentAttemptCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid payment-identifier payloads before verification", async () => {
    const { verifyX402Payment } = await import("./service.js");
    mocks.mockExtractAndValidatePaymentIdentifier.mockReturnValue({
      id: "bad-identifier",
      validation: {
        valid: false,
        errors: ["payment-identifier expired"],
      },
    });

    await expect(
      verifyX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: [source.network],
        supportedPaymentSourceId: source.id,
        paymentPayload: paymentPayload as never,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "payment-identifier expired",
    });

    expect(mocks.mockFacilitatorVerify).not.toHaveBeenCalled();
  });

  it.each([
    ["network", { network: "eip155:8453" }],
    ["token", { asset: "0x2222222222222222222222222222222222222222" }],
    ["amount", { amount: "999" }],
    ["payTo", { payTo: "0x3333333333333333333333333333333333333333" }],
  ])(
    "rejects verify payloads with the wrong registered %s",
    async (_field, acceptedPatch) => {
      const { verifyX402Payment } = await import("./service.js");
      await expect(
        verifyX402Payment({
          userId: USER_ID,
          orgApiKeyId: ORG_API_KEY_ID,
          caip2NetworkLimit: [source.network],
          supportedPaymentSourceId: source.id,
          paymentPayload: {
            ...paymentPayload,
            accepted: {
              ...requirements,
              ...acceptedPatch,
            },
          } as never,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message:
          "x402 payment requirements do not match the registered resource",
      });

      expect(mocks.mockFacilitatorVerify).not.toHaveBeenCalled();
    },
  );

  it("rejects settle payload requirement mismatches before replay lookup", async () => {
    const { settleX402Payment } = await import("./service.js");
    await expect(
      settleX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: [source.network],
        supportedPaymentSourceId: source.id,
        paymentPayload: {
          ...paymentPayload,
          accepted: {
            ...requirements,
            amount: "999",
          },
        } as never,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "x402 payment requirements do not match the registered resource",
    });

    expect(mocks.mockX402SettlementFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockFacilitatorSettle).not.toHaveBeenCalled();
  });

  it("rejects payment payloads for a different registered resource", async () => {
    const { verifyX402Payment } = await import("./service.js");
    await expect(
      verifyX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: [source.network],
        supportedPaymentSourceId: source.id,
        paymentPayload: {
          ...paymentPayload,
          resource: { url: "https://agent.example/other" },
        } as never,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.mockFacilitatorVerify).not.toHaveBeenCalled();
  });

  it("normalizes x402 budget assets to lowercase when upserting", async () => {
    const { setX402WalletBudget } = await import("./service.js");
    const result = await setX402WalletBudget({
      userId: USER_ID,
      orgApiKeyId: ORG_API_KEY_ID,
      evmWalletId: "wallet-1",
      caip2Network: source.network,
      asset: source.asset,
      remainingAmount: "100",
    });

    expect(result.asset).toBe(source.asset.toLowerCase());
    expect(mocks.mockBudgetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgApiKeyId_evmWalletId_caip2Network_asset: {
            orgApiKeyId: ORG_API_KEY_ID,
            evmWalletId: "wallet-1",
            caip2Network: source.network,
            asset: source.asset.toLowerCase(),
          },
        },
        create: expect.objectContaining({
          userId: USER_ID,
          asset: source.asset.toLowerCase(),
        }),
      }),
    );
  });

  it("rejects setting a budget for an unregistered network with a 404", async () => {
    const { setX402WalletBudget } = await import("./service.js");
    mocks.mockX402NetworkFindFirst.mockResolvedValueOnce(null);
    await expect(
      setX402WalletBudget({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        evmWalletId: "wallet-1",
        caip2Network: source.network,
        asset: source.asset,
        remainingAmount: "100",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.mockBudgetUpsert).not.toHaveBeenCalled();
  });

  it("rejects setting a budget for a missing wallet with a 404", async () => {
    const { setX402WalletBudget } = await import("./service.js");
    mocks.mockX402EvmWalletFindFirst.mockResolvedValueOnce(null);
    await expect(
      setX402WalletBudget({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        evmWalletId: "missing-wallet",
        caip2Network: source.network,
        asset: source.asset,
        remainingAmount: "100",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.mockBudgetUpsert).not.toHaveBeenCalled();
  });

  it("maps a duplicate managed wallet address to a 409", async () => {
    const { createX402ManagedWallet } = await import("./service.js");
    mocks.mockX402EvmWalletCreate.mockRejectedValueOnce(
      new MockPrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`address`)",
        "P2002",
      ),
    );
    await expect(
      createX402ManagedWallet({
        userId: USER_ID,
        type: "Purchasing" as never,
        privateKey: `0x${"a".repeat(64)}`,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("returns the generated private key once when no key is supplied", async () => {
    const { createX402ManagedWallet } = await import("./service.js");
    const result = await createX402ManagedWallet({
      userId: USER_ID,
      type: "Purchasing" as never,
    });
    expect(result.privateKey).toBe(`0x${"b".repeat(64)}`);
  });

  it("does not echo back a caller-supplied private key", async () => {
    const { createX402ManagedWallet } = await import("./service.js");
    const result = await createX402ManagedWallet({
      userId: USER_ID,
      type: "Purchasing" as never,
      privateKey: `0x${"a".repeat(64)}`,
    });
    expect(result.privateKey).toBeNull();
  });

  it("refuses to settle through a retired facilitator wallet", async () => {
    const { settleX402Payment } = await import("./service.js");
    mocks.mockX402NetworkFindFirst.mockResolvedValueOnce({
      ...networkRow,
      FacilitatorWallet: {
        ...networkRow.FacilitatorWallet,
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await expect(
      settleX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: null,
        supportedPaymentSourceId: source.id,
        paymentPayload: paymentPayload as never,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.mockFacilitatorSettle).not.toHaveBeenCalled();
  });

  it("refuses to settle through a facilitator wallet that is not a Selling wallet", async () => {
    const { settleX402Payment } = await import("./service.js");
    mocks.mockX402NetworkFindFirst.mockResolvedValueOnce({
      ...networkRow,
      FacilitatorWallet: {
        ...networkRow.FacilitatorWallet,
        type: "Purchasing",
      },
    });
    await expect(
      settleX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: null,
        supportedPaymentSourceId: source.id,
        paymentPayload: paymentPayload as never,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.mockFacilitatorSettle).not.toHaveBeenCalled();
  });

  it("rejects granting a budget to a Selling wallet", async () => {
    const { setX402WalletBudget } = await import("./service.js");
    mocks.mockX402EvmWalletFindFirst.mockResolvedValueOnce({
      id: "wallet-selling",
      address: "0xcccccccccccccccccccccccccccccccccccccccc",
      type: "Selling",
      encryptedPrivateKey: "encrypted-private-key",
      deletedAt: null,
    });
    await expect(
      setX402WalletBudget({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        evmWalletId: "wallet-selling",
        caip2Network: source.network,
        asset: source.asset,
        remainingAmount: "100",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.mockBudgetUpsert).not.toHaveBeenCalled();
  });

  describe("createX402Payment (buy side)", () => {
    it("signs a forwarded 402 with a managed wallet and returns the X-PAYMENT header", async () => {
      const { createX402Payment, hashX402PaymentPayload } =
        await import("./service.js");
      const result = await createX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: [source.network],
        evmWalletId: "wallet-1",
        paymentRequired: paymentRequired as never,
      });

      expect(result).toMatchObject({
        attemptId: "attempt-outbound-1",
        payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        caip2Network: source.network,
        asset: source.asset.toLowerCase(),
        amount: requirements.amount,
        payTo: source.payTo.toLowerCase(),
        xPaymentHeader: "x-payment-header-base64",
        paymentPayloadHash: hashX402PaymentPayload(paymentPayload),
        paymentIdentifier: null,
      });

      expect(mocks.mockBudgetUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "budget-1",
            remainingAmount: { gte: source.amount },
          }),
          data: {
            remainingAmount: { decrement: source.amount },
            spentAmount: { increment: source.amount },
          },
        }),
      );
      expect(mocks.mockTxPaymentAttemptCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: "OutboundPayment",
            asset: source.asset.toLowerCase(),
            userId: USER_ID,
          }),
        }),
      );
      expect(mocks.mockCreatePaymentPayload).toHaveBeenCalledWith(
        paymentRequired,
      );
      expect(mocks.mockX402PaymentAttemptUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "attempt-outbound-1" },
          data: expect.objectContaining({ status: "Verified" }),
        }),
      );
      expect(mocks.mockBudgetUpdate).not.toHaveBeenCalled();
    });

    it("pins the client policy to the single budgeted requirement", async () => {
      const { createX402Payment } = await import("./service.js");
      await createX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: [source.network],
        evmWalletId: "wallet-1",
        paymentRequired: paymentRequired as never,
      });

      const foreignRequirement = {
        ...requirements,
        payTo: "0x9999999999999999999999999999999999999999",
      };
      expect(mocks.latestClient?.policies).toHaveLength(1);
      expect(
        mocks.latestClient?.policies[0](2, [requirements, foreignRequirement]),
      ).toEqual([requirements]);
    });

    it("rejects when no accepts entry matches an allowed network", async () => {
      const { createX402Payment } = await import("./service.js");
      await expect(
        createX402Payment({
          userId: USER_ID,
          orgApiKeyId: ORG_API_KEY_ID,
          caip2NetworkLimit: ["eip155:1"],
          evmWalletId: "wallet-1",
          paymentRequired: paymentRequired as never,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(mocks.mockBudgetUpdateMany).not.toHaveBeenCalled();
      expect(mocks.mockCreatePaymentPayload).not.toHaveBeenCalled();
    });

    it("rejects when no managed wallet budget covers the requirement", async () => {
      const { createX402Payment } = await import("./service.js");
      mocks.mockBudgetFindFirst.mockResolvedValue(null);

      await expect(
        createX402Payment({
          userId: USER_ID,
          orgApiKeyId: ORG_API_KEY_ID,
          caip2NetworkLimit: [source.network],
          evmWalletId: "wallet-1",
          paymentRequired: paymentRequired as never,
        }),
      ).rejects.toMatchObject({ statusCode: 402 });

      expect(mocks.mockCreatePaymentPayload).not.toHaveBeenCalled();
    });

    it("rejects signing an outbound payment with a Selling wallet", async () => {
      const { createX402Payment } = await import("./service.js");
      mocks.mockX402EvmWalletFindFirst.mockResolvedValueOnce({
        id: "wallet-1",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        type: "Selling",
        encryptedPrivateKey: "encrypted-private-key",
        deletedAt: null,
      });

      await expect(
        createX402Payment({
          userId: USER_ID,
          orgApiKeyId: ORG_API_KEY_ID,
          caip2NetworkLimit: [source.network],
          evmWalletId: "wallet-1",
          paymentRequired: paymentRequired as never,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(mocks.mockCreatePaymentPayload).not.toHaveBeenCalled();
    });

    it.each([["-1000"], ["0"], ["1.5"], ["abc"], [""]])(
      "rejects a forwarded requirement with a non-positive/malformed amount %p without touching the budget",
      async (amount) => {
        const { createX402Payment } = await import("./service.js");
        await expect(
          createX402Payment({
            userId: USER_ID,
            orgApiKeyId: ORG_API_KEY_ID,
            caip2NetworkLimit: [source.network],
            evmWalletId: "wallet-1",
            paymentRequired: {
              ...paymentRequired,
              accepts: [{ ...requirements, amount }],
            } as never,
          }),
        ).rejects.toMatchObject({ statusCode: 400 });

        expect(mocks.mockBudgetUpdateMany).not.toHaveBeenCalled();
        expect(mocks.mockCreatePaymentPayload).not.toHaveBeenCalled();
      },
    );

    it("allows an admin (null network limit) to sign for any enabled network", async () => {
      const { createX402Payment } = await import("./service.js");
      const result = await createX402Payment({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        caip2NetworkLimit: null,
        evmWalletId: "wallet-1",
        paymentRequired: paymentRequired as never,
      });

      expect(result.xPaymentHeader).toBe("x-payment-header-base64");
    });

    it("refunds the reserved budget and fails the attempt when signing throws", async () => {
      const { createX402Payment } = await import("./service.js");
      mocks.mockCreatePaymentPayload.mockRejectedValue(new Error("sign boom"));

      await expect(
        createX402Payment({
          userId: USER_ID,
          orgApiKeyId: ORG_API_KEY_ID,
          caip2NetworkLimit: [source.network],
          evmWalletId: "wallet-1",
          paymentRequired: paymentRequired as never,
        }),
      ).rejects.toMatchObject({
        statusCode: 500,
        message: "x402 payment signing failed",
      });

      expect(mocks.mockX402PaymentAttemptUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "attempt-outbound-1" },
          data: expect.objectContaining({
            status: "Failed",
            errorReason: "x402_sign_failed",
          }),
        }),
      );
      expect(mocks.mockBudgetUpdate).toHaveBeenCalledWith({
        where: { id: "budget-1" },
        data: {
          remainingAmount: { increment: source.amount },
          spentAmount: { decrement: source.amount },
        },
      });
    });

    it("rejects (and refunds) when a paymentIdentifier is requested but the 402 does not support it", async () => {
      const { createX402Payment } = await import("./service.js");
      await expect(
        createX402Payment({
          userId: USER_ID,
          orgApiKeyId: ORG_API_KEY_ID,
          caip2NetworkLimit: [source.network],
          evmWalletId: "wallet-1",
          paymentRequired: paymentRequired as never,
          paymentIdentifier: "caller-supplied-id-123456",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(mocks.mockBudgetUpdate).toHaveBeenCalledWith({
        where: { id: "budget-1" },
        data: {
          remainingAmount: { increment: source.amount },
          spentAmount: { decrement: source.amount },
        },
      });
    });

    it("records the initiating user as createdByUserId on the budget", async () => {
      const { setX402WalletBudget } = await import("./service.js");
      await setX402WalletBudget({
        userId: USER_ID,
        orgApiKeyId: ORG_API_KEY_ID,
        evmWalletId: "wallet-1",
        caip2Network: source.network,
        asset: source.asset,
        remainingAmount: "100",
        createdByUserId: "admin-user-1",
      });

      expect(mocks.mockBudgetUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ createdByUserId: "admin-user-1" }),
        }),
      );
    });
  });
});
