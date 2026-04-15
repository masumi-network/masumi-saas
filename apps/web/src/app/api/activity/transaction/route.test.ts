import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const getSmartContractAddressForConfiguredSourceMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/resolve-smart-contract", () => ({
  getSmartContractAddressForConfiguredSource:
    getSmartContractAddressForConfiguredSourceMock,
}));

vi.mock("@/lib/schemas/api-query", () => ({
  activityTransactionQuerySchema: {
    safeParse: () => ({
      success: true as const,
      data: {
        id: "txn-1",
        type: "payment",
        network: "Mainnet",
      },
    }),
  },
}));

describe("/api/activity/transaction GET", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    getPaymentNodeClientForUserMock.mockResolvedValue({});
  });

  it("returns a clear 503 when Mainnet payment-source config is missing", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    getSmartContractAddressForConfiguredSourceMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    const request = new NextRequest(
      "https://saas.example.com/api/activity/transaction?id=txn-1&type=payment&network=Mainnet",
    );

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });
  });
});
