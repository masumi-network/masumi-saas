import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getUserOwnedAgentForEarningsMock = vi.fn();
const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/earnings/owned-agent", () => ({
  getUserOwnedAgentForEarnings: getUserOwnedAgentForEarningsMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

describe("/api/agents/[agentId]/earnings GET", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
  });

  it("keeps the existing camel-cased earnings response shape", async () => {
    const paymentClient = {
      getPaymentIncome: vi.fn().mockResolvedValue({
        totalTransactions: 2,
        periodStart: "2026-04-08T00:00:00.000Z",
        periodEnd: "2026-04-15T23:59:59.000Z",
        TotalIncome: {
          Units: [{ unit: "", amount: 2500000 }],
          blockchainFees: 150000,
        },
        TotalRefunded: {
          Units: [],
          blockchainFees: 0,
        },
        TotalPending: {
          Units: [],
          blockchainFees: 0,
        },
        DailyIncome: [
          {
            day: 14,
            month: 4,
            year: 2026,
            Units: [{ unit: "", amount: 2500000 }],
            blockchainFees: 150000,
          },
        ],
        DailyRefunded: [],
        DailyPending: [],
        MonthlyIncome: [
          {
            month: 4,
            year: 2026,
            Units: [{ unit: "", amount: 2500000 }],
            blockchainFees: 150000,
          },
        ],
        MonthlyRefunded: [],
        MonthlyPending: [],
      }),
    };

    getUserOwnedAgentForEarningsMock.mockResolvedValue({
      id: "agent-1",
      agentIdentifier: "agent-identifier-1",
      networkIdentifier: "Preprod",
      registrationState: "RegistrationConfirmed",
    });
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);

    const request = new NextRequest(
      "https://saas.example.com/api/agents/agent-1/earnings?period=7d",
    );

    const response = await GET(request, {
      params: Promise.resolve({ agentId: "agent-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        totalTransactions: 2,
        totalIncome: {
          units: [{ unit: "", amount: 2500000 }],
          blockchainFees: 150000,
        },
        totalRefunded: {
          units: [],
          blockchainFees: 0,
        },
        totalPending: {
          units: [],
          blockchainFees: 0,
        },
        periodStart: "2026-04-08T00:00:00.000Z",
        periodEnd: "2026-04-15T23:59:59.000Z",
        dailyIncome: [
          {
            day: 14,
            month: 4,
            year: 2026,
            units: [{ unit: "", amount: 2500000 }],
            blockchainFees: 150000,
          },
        ],
        monthlyIncome: [
          {
            month: 4,
            year: 2026,
            units: [{ unit: "", amount: 2500000 }],
            blockchainFees: 150000,
          },
        ],
      },
    });
  });

  it("keeps historical earnings available for fully deregistered agents", async () => {
    const paymentClient = {
      getPaymentIncome: vi.fn().mockResolvedValue({
        totalTransactions: 1,
        periodStart: "2026-04-08T00:00:00.000Z",
        periodEnd: "2026-04-15T23:59:59.000Z",
        TotalIncome: {
          Units: [{ unit: "", amount: 1000000 }],
          blockchainFees: 50000,
        },
        TotalRefunded: {
          Units: [],
          blockchainFees: 0,
        },
        TotalPending: {
          Units: [],
          blockchainFees: 0,
        },
        DailyIncome: [],
        DailyRefunded: [],
        DailyPending: [],
        MonthlyIncome: [],
        MonthlyRefunded: [],
        MonthlyPending: [],
      }),
    };

    getUserOwnedAgentForEarningsMock.mockResolvedValue({
      id: "agent-2",
      agentIdentifier: "agent-identifier-2",
      networkIdentifier: "Preprod",
      registrationState: "DeregistrationConfirmed",
      agentReference: null,
    });
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);

    const response = await GET(
      new NextRequest(
        "https://saas.example.com/api/agents/agent-2/earnings?period=7d",
      ),
      {
        params: Promise.resolve({ agentId: "agent-2" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        totalTransactions: 1,
      },
    });
    expect(getUserOwnedAgentForEarningsMock).toHaveBeenCalledWith({
      userId: "user-1",
      agentId: "agent-2",
    });
  });
});
