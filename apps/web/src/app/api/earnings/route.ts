import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";

import { agentHasPaymentIncomeData } from "@/lib/agents/agent-earnings-eligibility";
import { whereUserAgentsForPaymentNetwork } from "@/lib/agents/where-user-agents-for-payment-network";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  mergeDailyIncomeByDay,
  mergeIncomeUnitRows,
} from "@/lib/earnings/aggregate-dashboard-payment-income";
import type { PaymentNodeClient } from "@/lib/payment-node/client";
import {
  type DashboardEarningsAmountUnit,
  dashboardEarningsUnitFromTotals,
  type Network,
  splitIncomeUnitsStablecoinUsdAndAda,
} from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import type { PaymentIncomeOutput } from "@/lib/payment-node/schemas";
import { type EarningsPeriod, earningsQuerySchema } from "@/lib/schemas";

/**
 * Must match `getPaymentIncome({ timeZone })`. Bucket keys in `DailyIncome` are calendar days in this zone
 * (payment node uses spacetime with this IANA id); the chart axis must use the same interpretation.
 *
 * Dashboard totals are **per user agent** (not `agentIdentifier: null`), see `docs/dashboard-earnings.md`.
 */
const EARNINGS_PAYMENT_INCOME_TIMEZONE = "Etc/UTC";

/** Inclusive start date (UTC calendar day) for `period=all` chart and totals. */
const EARNINGS_ALL_TIME_START_YMD = "2024-12-01";

/**
 * Caps concurrent payment-node `getPaymentIncome` calls so large agent lists do not
 * fan out into 2×n parallel requests (current + previous windows) or hit upstream limits.
 */
const PAYMENT_INCOME_AGENT_CONCURRENCY = 5;

/**
 * Like `Promise.allSettled`, but runs at most `concurrency` tasks at a time.
 * Uses a stride partition (worker `slot` handles indices `slot, slot+W, …`) so there is no shared
 * mutable index across workers — safe across async boundaries without relying on sync `++` ordering.
 */
async function allSettledWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async (_, slot) => {
      for (let i = slot; i < items.length; i += workerCount) {
        try {
          const value = await fn(items[i]!, i);
          results[i] = { status: "fulfilled", value };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}

export type EarningsDataPoint = {
  date: string;
  amount: number;
};

export type EarningsApiResponse =
  | {
      success: true;
      data: {
        earnings: EarningsDataPoint[];
        total: number;
        /** Whether `total` / chart `amount` are USD (USDM / USDCx / tUSDM) or ADA (lovelace). */
        amountUnit: DashboardEarningsAmountUnit;
        /** Previous period total in the same `amountUnit` (omitted when `period=all`). */
        previousTotal?: number;
      };
    }
  | { success: false; error: string };

function dailyIncomeDayKey(d: {
  day: number;
  month: number;
  year: number;
}): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function utcCalendarTodayYmd(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Calendar arithmetic in UTC (matches {@link EARNINGS_PAYMENT_INCOME_TIMEZONE} when it is `Etc/UTC`). */
function addUtcCalendarDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function enumerateInclusiveDaysYmd(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startYmd}T12:00:00.000Z`);
  const end = new Date(`${endYmd}T12:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function getDashboardPeriodWindows(period: EarningsPeriod): {
  current: { startDate: string; endDate: string };
  previous: { startDate: string; endDate: string } | null;
} {
  const endStr = utcCalendarTodayYmd(new Date());

  if (period === "all") {
    return {
      current: { startDate: EARNINGS_ALL_TIME_START_YMD, endDate: endStr },
      previous: null,
    };
  }

  const spanDays = period === "24h" ? 1 : period === "30d" ? 30 : 7;
  const startStr = addUtcCalendarDays(endStr, -spanDays);
  const prevEndStr = addUtcCalendarDays(startStr, -1);
  const prevStartStr = addUtcCalendarDays(prevEndStr, -spanDays);

  return {
    current: { startDate: startStr, endDate: endStr },
    previous: { startDate: prevStartStr, endDate: prevEndStr },
  };
}

function primaryAmountFromUnits(
  units: Array<{ unit: string; amount: number }>,
  network: Network,
  unit: DashboardEarningsAmountUnit,
): number {
  const { usd, ada } = splitIncomeUnitsStablecoinUsdAndAda(units, network);
  return unit === "USD" ? usd : ada;
}

export async function GET(request: Request) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { user } = authContext;

    const { searchParams } = new URL(request.url);
    const queryResult = earningsQuerySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
      network: searchParams.get("network"),
    });
    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryResult.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 },
      );
    }
    const { period, network } = queryResult.data;
    requireNetworkedOidcApiScope(authContext, {
      resource: "earnings",
      action: "read",
      network,
    });

    const paymentNodeClient = await getPaymentNodeClientForUser(user.id);
    if (!paymentNodeClient) {
      return NextResponse.json({
        success: true,
        data: {
          earnings: [],
          total: 0,
          amountUnit: "USD",
        },
      } satisfies EarningsApiResponse);
    }

    const { current, previous } = getDashboardPeriodWindows(period);

    const userAgents = await prisma.agent.findMany({
      where: whereUserAgentsForPaymentNetwork(user.id, network),
      select: {
        id: true,
        agentIdentifier: true,
        registrationState: true,
      },
    });
    const eligibleAgents = userAgents.filter(agentHasPaymentIncomeData);

    const incomeRangeParams = (range: { startDate: string; endDate: string }) =>
      ({
        network,
        startDate: range.startDate,
        endDate: range.endDate,
        timeZone: EARNINGS_PAYMENT_INCOME_TIMEZONE,
      }) as const;

    async function fetchIncomeForEligible(
      range: { startDate: string; endDate: string },
      nodeClient: PaymentNodeClient,
    ): Promise<PaymentIncomeOutput[]> {
      if (eligibleAgents.length === 0) return [];
      const params = incomeRangeParams(range);
      const settled = await allSettledWithConcurrencyLimit(
        eligibleAgents,
        PAYMENT_INCOME_AGENT_CONCURRENCY,
        (a) =>
          nodeClient.getPaymentIncome({
            ...params,
            agentIdentifier: a.agentIdentifier!,
          }),
      );
      const ok: PaymentIncomeOutput[] = [];
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i]!;
        if (r.status === "fulfilled") {
          ok.push(r.value);
        } else {
          console.error(
            "[api/earnings] getPaymentIncome failed for agent",
            eligibleAgents[i]!.id,
            r.reason,
          );
        }
      }
      return ok;
    }

    // Load previous after current so peak concurrent payment-node calls stays at
    // PAYMENT_INCOME_AGENT_CONCURRENCY (not 2× when both windows exist).
    const currentIncomes = await fetchIncomeForEligible(
      current,
      paymentNodeClient,
    );
    const previousIncomes = previous
      ? await fetchIncomeForEligible(previous, paymentNodeClient)
      : [];

    const mergedCurrentUnits = mergeIncomeUnitRows(
      currentIncomes.map((i) => i.TotalIncome.Units),
    );
    const totalsCurrent = splitIncomeUnitsStablecoinUsdAndAda(
      mergedCurrentUnits,
      network,
    );
    const amountUnit = dashboardEarningsUnitFromTotals(totalsCurrent);
    const total = primaryAmountFromUnits(
      mergedCurrentUnits,
      network,
      amountUnit,
    );

    const dayMergedUnits = mergeDailyIncomeByDay(
      currentIncomes,
      dailyIncomeDayKey,
    );
    const chartDays = enumerateInclusiveDaysYmd(
      current.startDate,
      current.endDate,
    );
    const earnings: EarningsDataPoint[] = chartDays.map((date) => ({
      date,
      amount: primaryAmountFromUnits(
        dayMergedUnits.get(date) ?? [],
        network,
        amountUnit,
      ),
    }));

    let previousTotal: number | undefined;
    if (previous && previousIncomes.length > 0) {
      const mergedPreviousUnits = mergeIncomeUnitRows(
        previousIncomes.map((i) => i.TotalIncome.Units),
      );
      previousTotal = primaryAmountFromUnits(
        mergedPreviousUnits,
        network,
        amountUnit,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        earnings,
        total,
        amountUnit,
        ...(previousTotal !== undefined ? { previousTotal } : {}),
      },
    } satisfies EarningsApiResponse);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get earnings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load earnings" },
      { status: 500 },
    );
  }
}
