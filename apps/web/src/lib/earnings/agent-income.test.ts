import { describe, expect, it } from "vitest";

import {
  buildAgentEarningsAnalytics,
  resolveAgentAnalyticsPeriod,
} from "./agent-income";

describe("agent earnings helpers", () => {
  it("uses monthly granularity for all-time and long custom ranges", () => {
    expect(
      resolveAgentAnalyticsPeriod({
        range: "all",
        timeZone: "Etc/UTC",
        now: new Date("2026-04-15T10:00:00.000Z"),
      }),
    ).toMatchObject({
      startDate: "2020-01-01",
      endDate: "2026-04-15",
      granularity: "month",
    });

    expect(
      resolveAgentAnalyticsPeriod({
        range: "custom",
        startDate: "2026-01-01",
        endDate: "2026-04-15",
        timeZone: "Etc/UTC",
      }),
    ).toMatchObject({
      granularity: "month",
    });
  });

  it("resolves preset ranges against the requested local calendar day", () => {
    expect(
      resolveAgentAnalyticsPeriod({
        range: "7d",
        timeZone: "America/Los_Angeles",
        now: new Date("2026-04-15T00:30:00.000Z"),
      }),
    ).toMatchObject({
      startDate: "2026-04-08",
      endDate: "2026-04-14",
      granularity: "day",
    });

    expect(
      resolveAgentAnalyticsPeriod({
        range: "30d",
        timeZone: "Etc/UTC",
        now: new Date("2026-04-15T10:00:00.000Z"),
      }),
    ).toMatchObject({
      startDate: "2026-03-17",
      endDate: "2026-04-15",
      granularity: "day",
    });
  });

  it("normalizes totals and zero-fills missing series buckets into a single display unit", () => {
    const analytics = buildAgentEarningsAnalytics({
      network: "Preprod",
      range: "custom",
      granularity: "day",
      timeZone: "Etc/UTC",
      resolvedStartDate: "2026-04-10",
      resolvedEndDate: "2026-04-12",
      income: {
        totalTransactions: 3,
        periodStart: "2026-04-10T00:00:00.000Z",
        periodEnd: "2026-04-12T23:59:59.000Z",
        totalIncome: {
          units: [
            {
              unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
              amount: 1250000,
            },
          ],
          blockchainFees: 250000,
        },
        totalRefunded: {
          units: [
            {
              unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
              amount: 250000,
            },
          ],
          blockchainFees: 50000,
        },
        totalPending: {
          units: [{ unit: "", amount: 3000000 }],
          blockchainFees: 0,
        },
        dailyIncome: [
          {
            day: 11,
            month: 4,
            year: 2026,
            units: [
              {
                unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
                amount: 500000,
              },
            ],
            blockchainFees: 100000,
          },
        ],
        dailyRefunded: [],
        dailyPending: [
          {
            day: 12,
            month: 4,
            year: 2026,
            units: [{ unit: "", amount: 3000000 }],
            blockchainFees: 0,
          },
        ],
        monthlyIncome: [],
        monthlyRefunded: [],
        monthlyPending: [],
      },
    });

    expect(analytics.displayUnit).toBe("USD");
    expect(analytics.totals.income.displayAmount).toBe(1.25);
    expect(analytics.totals.income.displayUnit).toBe("USD");
    expect(analytics.totals.refunded.displayAmount).toBe(0.25);
    expect(analytics.totals.pending.displayAmount).toBe(3);
    expect(analytics.totals.pending.displayUnit).toBe("ADA");
    expect(analytics.series.income).toHaveLength(3);
    expect(analytics.series.income[0]).toMatchObject({
      key: "2026-04-10",
      amount: 0,
    });
    expect(analytics.series.income[1]).toMatchObject({
      key: "2026-04-11",
      amount: 0.5,
    });
    expect(analytics.series.income[2]).toMatchObject({
      key: "2026-04-12",
      amount: 0,
    });
    expect(analytics.series.pending).toHaveLength(3);
    expect(analytics.series.pending[0]).toMatchObject({
      key: "2026-04-10",
      amount: 0,
    });
    expect(analytics.series.pending[2]).toMatchObject({
      key: "2026-04-12",
      amount: 3,
      displayUnit: "ADA",
    });
  });

  it("preserves both USD and ADA totals for mixed-unit metrics", () => {
    const analytics = buildAgentEarningsAnalytics({
      network: "Preprod",
      range: "30d",
      granularity: "day",
      timeZone: "Etc/UTC",
      resolvedStartDate: "2026-04-10",
      resolvedEndDate: "2026-04-10",
      income: {
        totalTransactions: 2,
        periodStart: "2026-04-10T00:00:00.000Z",
        periodEnd: "2026-04-10T23:59:59.000Z",
        totalIncome: {
          units: [
            {
              unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
              amount: 1250000,
            },
            { unit: "", amount: 3000000 },
          ],
          blockchainFees: 250000,
        },
        totalRefunded: {
          units: [],
          blockchainFees: 0,
        },
        totalPending: {
          units: [],
          blockchainFees: 0,
        },
        dailyIncome: [
          {
            day: 10,
            month: 4,
            year: 2026,
            units: [
              {
                unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
                amount: 1250000,
              },
              { unit: "", amount: 3000000 },
            ],
            blockchainFees: 250000,
          },
        ],
        dailyRefunded: [],
        dailyPending: [],
        monthlyIncome: [],
        monthlyRefunded: [],
        monthlyPending: [],
      },
    });

    expect(analytics.totals.income).toMatchObject({
      usdAmount: 1.25,
      adaAmount: 3,
      displayUnit: "USD",
      displayAmount: 1.25,
      hasMixedUnits: true,
    });
    expect(analytics.series.income[0]).toMatchObject({
      amount: 1.25,
      usdAmount: 1.25,
      adaAmount: 3,
      displayUnit: "USD",
      hasMixedUnits: true,
    });
  });

  it("counts mainnet USDCx as USD in analytics totals", () => {
    const analytics = buildAgentEarningsAnalytics({
      network: "Mainnet",
      range: "30d",
      granularity: "day",
      timeZone: "Etc/UTC",
      resolvedStartDate: "2026-04-10",
      resolvedEndDate: "2026-04-10",
      income: {
        totalTransactions: 1,
        periodStart: "2026-04-10T00:00:00.000Z",
        periodEnd: "2026-04-10T23:59:59.000Z",
        totalIncome: {
          units: [
            {
              unit: "1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e345553444378",
              amount: 1250000,
            },
          ],
          blockchainFees: 0,
        },
        totalRefunded: {
          units: [],
          blockchainFees: 0,
        },
        totalPending: {
          units: [],
          blockchainFees: 0,
        },
        dailyIncome: [
          {
            day: 10,
            month: 4,
            year: 2026,
            units: [
              {
                unit: "1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e345553444378",
                amount: 1250000,
              },
            ],
            blockchainFees: 0,
          },
        ],
        dailyRefunded: [],
        dailyPending: [],
        monthlyIncome: [],
        monthlyRefunded: [],
        monthlyPending: [],
      },
    });

    expect(analytics.totals.income).toMatchObject({
      usdAmount: 1.25,
      adaAmount: 0,
      displayUnit: "USD",
      displayAmount: 1.25,
      hasMixedUnits: false,
    });
    expect(analytics.series.income[0]).toMatchObject({
      amount: 1.25,
      usdAmount: 1.25,
      displayUnit: "USD",
    });
  });

  it("zero-fills missing monthly buckets for long ranges", () => {
    const analytics = buildAgentEarningsAnalytics({
      network: "Preprod",
      range: "all",
      granularity: "month",
      timeZone: "Etc/UTC",
      resolvedStartDate: "2026-01-01",
      resolvedEndDate: "2026-03-31",
      income: {
        totalTransactions: 1,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-03-31T23:59:59.000Z",
        totalIncome: {
          units: [
            {
              unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
              amount: 1000000,
            },
          ],
          blockchainFees: 100000,
        },
        totalRefunded: {
          units: [],
          blockchainFees: 0,
        },
        totalPending: {
          units: [],
          blockchainFees: 0,
        },
        dailyIncome: [],
        dailyRefunded: [],
        dailyPending: [],
        monthlyIncome: [
          {
            month: 3,
            year: 2026,
            units: [
              {
                unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
                amount: 1000000,
              },
            ],
            blockchainFees: 100000,
          },
        ],
        monthlyRefunded: [],
        monthlyPending: [],
      },
    });

    expect(analytics.series.income).toHaveLength(3);
    expect(analytics.series.income[0]).toMatchObject({
      key: "2026-01",
      amount: 0,
    });
    expect(analytics.series.income[1]).toMatchObject({
      key: "2026-02",
      amount: 0,
    });
    expect(analytics.series.income[2]).toMatchObject({
      key: "2026-03",
      amount: 1,
    });
  });
});
