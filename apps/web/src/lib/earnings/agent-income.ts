import "server-only";

import type { PaymentNodeClient } from "@/lib/payment-node/client";
import {
  type DashboardEarningsAmountUnit,
  dashboardEarningsUnitFromTotals,
  type Network,
  splitIncomeUnitsStablecoinUsdAndAda,
} from "@/lib/payment-node/format";
import type { AgentAnalyticsRange } from "@/lib/schemas";

type UnitAmount = { unit: string; amount: number };

export type NormalizedIncomeMetricBlock = {
  units: UnitAmount[];
  blockchainFees: number;
};

export type NormalizedIncomeBucket = {
  day?: number;
  month: number;
  year: number;
  units: UnitAmount[];
  blockchainFees: number;
};

export type NormalizedAgentPaymentIncome = {
  totalTransactions: number;
  periodStart: string;
  periodEnd: string;
  totalIncome: NormalizedIncomeMetricBlock;
  totalRefunded: NormalizedIncomeMetricBlock;
  totalPending: NormalizedIncomeMetricBlock;
  dailyIncome: NormalizedIncomeBucket[];
  dailyRefunded: NormalizedIncomeBucket[];
  dailyPending: NormalizedIncomeBucket[];
  monthlyIncome: NormalizedIncomeBucket[];
  monthlyRefunded: NormalizedIncomeBucket[];
  monthlyPending: NormalizedIncomeBucket[];
};

export type AgentEarningsGranularity = "day" | "month";

export type AgentEarningsMetric = "income" | "refunded" | "pending";

export type AgentEarningsDisplay = {
  usdAmount: number;
  adaAmount: number;
  displayUnit: DashboardEarningsAmountUnit;
  displayAmount: number;
  hasMixedUnits: boolean;
};

export type AgentEarningsSummary = NormalizedIncomeMetricBlock &
  AgentEarningsDisplay;

export type AgentEarningsSeriesPoint = AgentEarningsDisplay & {
  key: string;
  label: string;
  amount: number;
  units: UnitAmount[];
  blockchainFees: number;
};

export type AgentEarningsAnalytics = {
  period: {
    range: AgentAnalyticsRange;
    granularity: AgentEarningsGranularity;
    startDate: string;
    endDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    timeZone: string;
  };
  totalTransactions: number;
  displayUnit: DashboardEarningsAmountUnit;
  totals: {
    income: AgentEarningsSummary;
    refunded: AgentEarningsSummary;
    pending: AgentEarningsSummary;
  };
  series: Record<AgentEarningsMetric, AgentEarningsSeriesPoint[]>;
};

export const AGENT_STATES_WITH_EARNINGS = new Set([
  "RegistrationConfirmed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
]);

function utcCalendarTodayYmd(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function calendarDateInTimeZoneYmd(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-iso8601", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return utcCalendarTodayYmd(now);
  }

  return `${year}-${month}-${day}`;
}

function addUtcCalendarDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function diffUtcCalendarDays(startYmd: string, endYmd: string): number {
  const [startY, startM, startD] = startYmd.split("-").map(Number);
  const [endY, endM, endD] = endYmd.split("-").map(Number);
  const startMs = Date.UTC(startY, startM - 1, startD);
  const endMs = Date.UTC(endY, endM - 1, endD);
  return Math.floor((endMs - startMs) / 86_400_000);
}

function monthStartYmd(ymd: string): string {
  const [year, month] = ymd.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function addUtcCalendarMonths(ymd: string, deltaMonths: number): string {
  const [year, month] = ymd.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function pickDisplayUnit(
  totals: NormalizedIncomeMetricBlock[],
  network: Network,
): DashboardEarningsAmountUnit {
  const aggregate = totals.reduce(
    (acc, entry) => {
      const split = splitIncomeUnitsStablecoinUsdAndAda(entry.units, network);
      acc.usd += split.usd;
      acc.ada += split.ada;
      return acc;
    },
    { usd: 0, ada: 0 },
  );

  return dashboardEarningsUnitFromTotals(aggregate);
}

function buildSummary(
  metric: NormalizedIncomeMetricBlock,
  network: Network,
): AgentEarningsSummary {
  const display = buildDisplay(metric.units, network);
  return {
    ...metric,
    ...display,
  };
}

function buildDisplay(
  units: UnitAmount[],
  network: Network,
): AgentEarningsDisplay {
  const { usd, ada } = splitIncomeUnitsStablecoinUsdAndAda(units, network);
  const displayUnit = dashboardEarningsUnitFromTotals({ usd, ada });

  return {
    usdAmount: usd,
    adaAmount: ada,
    displayUnit,
    displayAmount: displayUnit === "USD" ? usd : ada,
    hasMixedUnits: usd > 0 && ada > 0,
  };
}

function monthKey(bucket: { month: number; year: number }): string {
  return `${bucket.year}-${String(bucket.month).padStart(2, "0")}`;
}

function dayKey(bucket: { day?: number; month: number; year: number }): string {
  return `${bucket.year}-${String(bucket.month).padStart(2, "0")}-${String(bucket.day ?? 1).padStart(2, "0")}`;
}

function formatBucketLabel(
  bucket: NormalizedIncomeBucket,
  granularity: AgentEarningsGranularity,
): string {
  const date =
    granularity === "day"
      ? new Date(
          Date.UTC(bucket.year, bucket.month - 1, Math.max(bucket.day ?? 1, 1)),
        )
      : new Date(Date.UTC(bucket.year, bucket.month - 1, 1));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    ...(granularity === "day" ? { day: "numeric" as const } : {}),
    year: bucket.year === new Date().getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

function enumerateSeriesBuckets(params: {
  granularity: AgentEarningsGranularity;
  startDate: string;
  endDate: string;
}): NormalizedIncomeBucket[] {
  if (params.granularity === "day") {
    const buckets: NormalizedIncomeBucket[] = [];
    for (
      let cursor = params.startDate;
      cursor.localeCompare(params.endDate) <= 0;
      cursor = addUtcCalendarDays(cursor, 1)
    ) {
      const [year, month, day] = cursor.split("-").map(Number);
      buckets.push({
        year,
        month,
        day,
        units: [],
        blockchainFees: 0,
      });
    }
    return buckets;
  }

  const buckets: NormalizedIncomeBucket[] = [];
  for (
    let cursor = monthStartYmd(params.startDate);
    cursor.localeCompare(monthStartYmd(params.endDate)) <= 0;
    cursor = addUtcCalendarMonths(cursor, 1)
  ) {
    const [year, month] = cursor.split("-").map(Number);
    buckets.push({
      year,
      month,
      units: [],
      blockchainFees: 0,
    });
  }
  return buckets;
}

function fillSeriesBuckets(params: {
  buckets: NormalizedIncomeBucket[];
  granularity: AgentEarningsGranularity;
  startDate: string;
  endDate: string;
}): NormalizedIncomeBucket[] {
  const keyedBuckets = new Map(
    params.buckets.map((bucket) => [
      params.granularity === "day"
        ? dayKey(bucket)
        : monthKey({ month: bucket.month, year: bucket.year }),
      bucket,
    ]),
  );

  return enumerateSeriesBuckets({
    granularity: params.granularity,
    startDate: params.startDate,
    endDate: params.endDate,
  }).map((bucket) => {
    const key =
      params.granularity === "day"
        ? dayKey(bucket)
        : monthKey({ month: bucket.month, year: bucket.year });
    return keyedBuckets.get(key) ?? bucket;
  });
}

function buildSeriesPoints(params: {
  buckets: NormalizedIncomeBucket[];
  granularity: AgentEarningsGranularity;
  network: Network;
  resolvedStartDate: string;
  resolvedEndDate: string;
}): AgentEarningsSeriesPoint[] {
  return fillSeriesBuckets({
    buckets: params.buckets,
    granularity: params.granularity,
    startDate: params.resolvedStartDate,
    endDate: params.resolvedEndDate,
  }).map((bucket) => {
    const display = buildDisplay(bucket.units, params.network);

    return {
      key:
        params.granularity === "day"
          ? dayKey(bucket)
          : monthKey({ month: bucket.month, year: bucket.year }),
      label: formatBucketLabel(bucket, params.granularity),
      ...display,
      amount: display.displayAmount,
      units: bucket.units,
      blockchainFees: bucket.blockchainFees,
    };
  });
}

export function hasAgentEarningsData(agent: {
  agentIdentifier: string | null;
  registrationState: string;
}): boolean {
  return Boolean(
    agent.agentIdentifier &&
    AGENT_STATES_WITH_EARNINGS.has(agent.registrationState),
  );
}

export function resolveAgentAnalyticsPeriod(params: {
  range: AgentAnalyticsRange;
  startDate?: string;
  endDate?: string;
  timeZone: string;
  now?: Date;
}): {
  range: AgentAnalyticsRange;
  startDate: string;
  endDate: string;
  granularity: AgentEarningsGranularity;
} {
  const today = calendarDateInTimeZoneYmd(
    params.now ?? new Date(),
    params.timeZone,
  );

  if (params.range === "custom") {
    if (!params.startDate || !params.endDate) {
      throw new Error("Custom range requires startDate and endDate");
    }

    const daySpan = diffUtcCalendarDays(params.startDate, params.endDate);
    return {
      range: params.range,
      startDate: params.startDate,
      endDate: params.endDate,
      granularity: daySpan >= 90 ? "month" : "day",
    };
  }

  if (params.range === "all") {
    return {
      range: params.range,
      startDate: "2020-01-01",
      endDate: today,
      granularity: "month",
    };
  }

  const spanDays =
    params.range === "90d" ? 90 : params.range === "30d" ? 30 : 7;

  return {
    range: params.range,
    startDate: addUtcCalendarDays(today, -(spanDays - 1)),
    endDate: today,
    granularity: "day",
  };
}

export async function fetchNormalizedAgentPaymentIncome(params: {
  client: PaymentNodeClient;
  network: Network;
  agentIdentifier: string;
  startDate: string;
  endDate: string;
  timeZone: string;
}): Promise<NormalizedAgentPaymentIncome> {
  const income = await params.client.getPaymentIncome({
    network: params.network,
    agentIdentifier: params.agentIdentifier,
    startDate: params.startDate,
    endDate: params.endDate,
    timeZone: params.timeZone,
  });

  return {
    totalTransactions: income.totalTransactions,
    periodStart: income.periodStart,
    periodEnd: income.periodEnd,
    totalIncome: {
      units: income.TotalIncome.Units,
      blockchainFees: income.TotalIncome.blockchainFees,
    },
    totalRefunded: {
      units: income.TotalRefunded.Units,
      blockchainFees: income.TotalRefunded.blockchainFees,
    },
    totalPending: {
      units: income.TotalPending.Units,
      blockchainFees: income.TotalPending.blockchainFees,
    },
    dailyIncome: income.DailyIncome.map((entry) => ({
      day: entry.day,
      month: entry.month,
      year: entry.year,
      units: entry.Units,
      blockchainFees: entry.blockchainFees,
    })),
    dailyRefunded: income.DailyRefunded.map((entry) => ({
      day: entry.day,
      month: entry.month,
      year: entry.year,
      units: entry.Units,
      blockchainFees: entry.blockchainFees,
    })),
    dailyPending: income.DailyPending.map((entry) => ({
      day: entry.day,
      month: entry.month,
      year: entry.year,
      units: entry.Units,
      blockchainFees: entry.blockchainFees,
    })),
    monthlyIncome: income.MonthlyIncome.map((entry) => ({
      month: entry.month,
      year: entry.year,
      units: entry.Units,
      blockchainFees: entry.blockchainFees,
    })),
    monthlyRefunded: income.MonthlyRefunded.map((entry) => ({
      month: entry.month,
      year: entry.year,
      units: entry.Units,
      blockchainFees: entry.blockchainFees,
    })),
    monthlyPending: income.MonthlyPending.map((entry) => ({
      month: entry.month,
      year: entry.year,
      units: entry.Units,
      blockchainFees: entry.blockchainFees,
    })),
  };
}

export function buildAgentEarningsAnalytics(params: {
  income: NormalizedAgentPaymentIncome;
  network: Network;
  range: AgentAnalyticsRange;
  granularity: AgentEarningsGranularity;
  timeZone: string;
  resolvedStartDate: string;
  resolvedEndDate: string;
}): AgentEarningsAnalytics {
  const displayUnit = pickDisplayUnit(
    [
      params.income.totalIncome,
      params.income.totalRefunded,
      params.income.totalPending,
    ],
    params.network,
  );

  const useMonthly = params.granularity === "month";

  return {
    period: {
      range: params.range,
      granularity: params.granularity,
      startDate: params.resolvedStartDate,
      endDate: params.resolvedEndDate,
      periodStart: params.income.periodStart,
      periodEnd: params.income.periodEnd,
      timeZone: params.timeZone,
    },
    totalTransactions: params.income.totalTransactions,
    displayUnit,
    totals: {
      income: buildSummary(params.income.totalIncome, params.network),
      refunded: buildSummary(params.income.totalRefunded, params.network),
      pending: buildSummary(params.income.totalPending, params.network),
    },
    series: {
      income: buildSeriesPoints({
        buckets: useMonthly
          ? params.income.monthlyIncome
          : params.income.dailyIncome,
        granularity: params.granularity,
        network: params.network,
        resolvedStartDate: params.resolvedStartDate,
        resolvedEndDate: params.resolvedEndDate,
      }),
      refunded: buildSeriesPoints({
        buckets: useMonthly
          ? params.income.monthlyRefunded
          : params.income.dailyRefunded,
        granularity: params.granularity,
        network: params.network,
        resolvedStartDate: params.resolvedStartDate,
        resolvedEndDate: params.resolvedEndDate,
      }),
      pending: buildSeriesPoints({
        buckets: useMonthly
          ? params.income.monthlyPending
          : params.income.dailyPending,
        granularity: params.granularity,
        network: params.network,
        resolvedStartDate: params.resolvedStartDate,
        resolvedEndDate: params.resolvedEndDate,
      }),
    },
  };
}

export function buildEmptyAgentEarningsAnalytics(params: {
  network: Network;
  range: AgentAnalyticsRange;
  granularity: AgentEarningsGranularity;
  timeZone: string;
  resolvedStartDate: string;
  resolvedEndDate: string;
}): AgentEarningsAnalytics {
  const emptyMetric: AgentEarningsSummary = {
    units: [],
    blockchainFees: 0,
    usdAmount: 0,
    adaAmount: 0,
    displayUnit: dashboardEarningsUnitFromTotals({ usd: 0, ada: 0 }),
    displayAmount: 0,
    hasMixedUnits: false,
  };

  return {
    period: {
      range: params.range,
      granularity: params.granularity,
      startDate: params.resolvedStartDate,
      endDate: params.resolvedEndDate,
      periodStart: null,
      periodEnd: null,
      timeZone: params.timeZone,
    },
    totalTransactions: 0,
    displayUnit: dashboardEarningsUnitFromTotals({ usd: 0, ada: 0 }),
    totals: {
      income: emptyMetric,
      refunded: emptyMetric,
      pending: emptyMetric,
    },
    series: {
      income: [],
      refunded: [],
      pending: [],
    },
  };
}
