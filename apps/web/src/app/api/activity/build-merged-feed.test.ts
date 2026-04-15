import { beforeEach, describe, expect, it, vi } from "vitest";

const getPaymentNodeClientForUserMock = vi.fn();
const getSmartContractAddressForConfiguredSourceMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findMany: vi.fn(),
    },
    agentActivityEvent: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/resolve-smart-contract", () => ({
  getSmartContractAddressForConfiguredSource:
    getSmartContractAddressForConfiguredSourceMock,
}));

describe("loadActivityTransactionFeedPart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rethrows payment-node config errors instead of degrading into an empty feed", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    const { loadActivityTransactionFeedPart } =
      await import("./build-merged-feed");

    getPaymentNodeClientForUserMock.mockResolvedValue({
      listPaymentDiff: vi.fn(),
      listPurchaseDiff: vi.fn(),
      listPayments: vi.fn(),
      listPurchases: vi.fn(),
    });
    getSmartContractAddressForConfiguredSourceMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    await expect(
      loadActivityTransactionFeedPart({
        userId: "user-1",
        network: "Mainnet",
        validFilter: "transactions",
        lastUpdate: undefined,
        agents: [],
        agentByIdentifier: new Map(),
      }),
    ).rejects.toMatchObject({
      name: "PaymentNodeConfigError",
      message:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });
  });

  it("still treats non-config payment-node failures as best-effort", async () => {
    const { loadActivityTransactionFeedPart } =
      await import("./build-merged-feed");

    getPaymentNodeClientForUserMock.mockResolvedValue({
      listPaymentDiff: vi.fn(),
      listPurchaseDiff: vi.fn(),
      listPayments: vi.fn(),
      listPurchases: vi.fn(),
    });
    getSmartContractAddressForConfiguredSourceMock.mockRejectedValue(
      new Error("temporary payment-node outage"),
    );

    await expect(
      loadActivityTransactionFeedPart({
        userId: "user-1",
        network: "Mainnet",
        validFilter: "transactions",
        lastUpdate: undefined,
        agents: [],
        agentByIdentifier: new Map(),
      }),
    ).resolves.toStrictEqual({
      transactionItems: [],
      transactionLastUpdate: undefined,
    });
  });
});
