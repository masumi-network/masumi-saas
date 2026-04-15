import { NextRequest } from "next/server";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getUserOwnedAgentForEarningsMock = vi.fn();
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

describe("/api/earnings/agent GET", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));

    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns historical analytics for a deregistered owned agent and zero-fills the preset range", async () => {
    const paymentClient = {
      getPaymentIncome: vi.fn().mockResolvedValue({
        totalTransactions: 5,
        periodStart: "2026-03-17T00:00:00.000Z",
        periodEnd: "2026-04-15T23:59:59.000Z",
        TotalIncome: {
          Units: [
            {
              unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
              amount: 2500000,
            },
          ],
          blockchainFees: 350000,
        },
        TotalRefunded: {
          Units: [],
          blockchainFees: 0,
        },
        TotalPending: {
          Units: [{ unit: "", amount: 4000000 }],
          blockchainFees: 0,
        },
        DailyIncome: [
          {
            day: 10,
            month: 4,
            year: 2026,
            Units: [
              {
                unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
                amount: 1000000,
              },
            ],
            blockchainFees: 100000,
          },
        ],
        DailyRefunded: [],
        DailyPending: [
          {
            day: 11,
            month: 4,
            year: 2026,
            Units: [{ unit: "", amount: 4000000 }],
            blockchainFees: 0,
          },
        ],
        MonthlyIncome: [],
        MonthlyRefunded: [],
        MonthlyPending: [],
      }),
    };

    getUserOwnedAgentForEarningsMock.mockResolvedValue({
      id: "agent-1",
      name: "Alpha",
      icon: null,
      agentIdentifier: "agent-identifier-1",
      networkIdentifier: "Preprod",
      registrationState: "DeregistrationConfirmed",
      agentReference: null,
    });
    getPaymentNodeClientForUserMock.mockResolvedValue(paymentClient);

    const request = new NextRequest(
      "https://saas.example.com/api/earnings/agent?agentId=agent-1&network=Preprod&range=30d&timeZone=Etc%2FUTC",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        agent: {
          id: "agent-1",
          name: "Alpha",
          network: "Preprod",
        },
        period: {
          range: "30d",
          granularity: "day",
          startDate: "2026-03-17",
          endDate: "2026-04-15",
          timeZone: "Etc/UTC",
        },
        totalTransactions: 5,
        displayUnit: "USD",
        totals: {
          income: {
            displayAmount: 2.5,
            displayUnit: "USD",
          },
          pending: {
            displayAmount: 4,
            displayUnit: "ADA",
          },
        },
      },
    });

    expect(body.data.series.income).toHaveLength(30);
    expect(body.data.series.refunded).toHaveLength(30);
    expect(body.data.series.pending).toHaveLength(30);
    expect(body.data.series.income[0]).toMatchObject({
      key: "2026-03-17",
      amount: 0,
    });
    expect(body.data.series.income.at(-1)).toMatchObject({
      key: "2026-04-15",
      amount: 0,
    });
    expect(body.data.series.income).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "2026-04-10", amount: 1 }),
      ]),
    );
    expect(body.data.series.pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "2026-04-11",
          amount: 4,
          displayUnit: "ADA",
        }),
      ]),
    );
    expect(paymentClient.getPaymentIncome).toHaveBeenCalledWith({
      network: "Preprod",
      agentIdentifier: "agent-identifier-1",
      startDate: "2026-03-17",
      endDate: "2026-04-15",
      timeZone: "Etc/UTC",
    });
    expect(getUserOwnedAgentForEarningsMock).toHaveBeenCalledWith({
      userId: "user-1",
      agentId: "agent-1",
    });
  });

  it("rejects custom ranges that are missing dates", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/earnings/agent?agentId=agent-1&network=Mainnet&range=custom",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error:
        "Start date is required for a custom range; End date is required for a custom range",
    });
  });

  it("returns not found when the selected agent is not visible on the chosen network", async () => {
    getUserOwnedAgentForEarningsMock.mockResolvedValue(null);

    const request = new NextRequest(
      "https://saas.example.com/api/earnings/agent?agentId=agent-404&network=Preprod&range=7d",
    );

    const response = await GET(request);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Agent not found",
    });
  });

  it("returns a zero-data payload for ineligible agents without touching payment income", async () => {
    getUserOwnedAgentForEarningsMock.mockResolvedValue({
      id: "agent-2",
      name: "Beta",
      icon: null,
      agentIdentifier: null,
      networkIdentifier: "Preprod",
      registrationState: "RegistrationRequested",
      agentReference: null,
    });

    const request = new NextRequest(
      "https://saas.example.com/api/earnings/agent?agentId=agent-2&network=Preprod&range=90d",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        agent: {
          id: "agent-2",
          name: "Beta",
        },
        totalTransactions: 0,
        totals: {
          income: {
            displayAmount: 0,
            displayUnit: "USD",
          },
          refunded: {
            displayAmount: 0,
            displayUnit: "USD",
          },
          pending: {
            displayAmount: 0,
            displayUnit: "USD",
          },
        },
        series: {
          income: [],
          refunded: [],
          pending: [],
        },
      },
    });
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
  });
});
