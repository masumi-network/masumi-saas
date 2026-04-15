import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import {
  type DashboardEarningsAmountUnit,
  dashboardEarningsUnitFromTotals,
  type Network,
  splitIncomeUnitsStablecoinUsdAndAda,
} from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { type EarningsPeriod, earningsQuerySchema } from "@/lib/schemas";

import contract from "./route.contract";

/**
 * Must match `getPaymentIncome({ timeZone })`. Bucket keys in `DailyIncome` are calendar days in this zone
 * (payment node uses spacetime with this IANA id); the chart axis must use the same interpretation.
 */
const EARNINGS_PAYMENT_INCOME_TIMEZONE = "Etc/UTC";

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
        /** Whether `total` / chart `amount` are USD (USDM) or ADA (lovelace). */
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

/**
 * Calendar day (YYYY-MM-DD) for an instant in the same timezone passed to the payment-node income API,
 * so chart labels align with `DailyIncome` bucket keys.
 */
function ymdInIncomeTimeZone(isoTimestamp: string, timeZone: string): string {
  const d = new Date(isoTimestamp);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
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
      current: { startDate: "2020-01-01", endDate: endStr },
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

    const { searchParams } = new URL(request.url);
    const queryResult = earningsQuerySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
      network: searchParams.get("network"),
    });
    if (!queryResult.success) {
      return contractJsonResponse(contract, "GET", 400, {
        success: false,
        error: queryResult.error.issues.map((i) => i.message).join("; "),
      });
    }
    const { period, network } = queryResult.data;
    requireNetworkedOidcApiScope(authContext, {
      resource: "earnings",
      action: "read",
      network,
    });

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: {
          earnings: [],
          total: 0,
          amountUnit: "USD",
        },
      } satisfies EarningsApiResponse);
    }

    const { current, previous } = getDashboardPeriodWindows(period);

    const [currentIncome, previousIncome] = await Promise.all([
      client.getPaymentIncome({
        network,
        agentIdentifier: null,
        startDate: current.startDate,
        endDate: current.endDate,
        timeZone: EARNINGS_PAYMENT_INCOME_TIMEZONE,
      }),
      previous
        ? client.getPaymentIncome({
            network,
            agentIdentifier: null,
            startDate: previous.startDate,
            endDate: previous.endDate,
            timeZone: EARNINGS_PAYMENT_INCOME_TIMEZONE,
          })
        : Promise.resolve(null),
    ]);

    const totalsCurrent = splitIncomeUnitsStablecoinUsdAndAda(
      currentIncome.TotalIncome.Units,
      network,
    );
    const amountUnit = dashboardEarningsUnitFromTotals(totalsCurrent);
    const total = primaryAmountFromUnits(
      currentIncome.TotalIncome.Units,
      network,
      amountUnit,
    );

    const dayAmount = new Map<string, number>();
    for (const row of currentIncome.DailyIncome) {
      const key = dailyIncomeDayKey(row);
      const prev = dayAmount.get(key) ?? 0;
      const add = primaryAmountFromUnits(row.Units, network, amountUnit);
      dayAmount.set(key, prev + add);
    }

    const chartStartYmd = ymdInIncomeTimeZone(
      currentIncome.periodStart,
      EARNINGS_PAYMENT_INCOME_TIMEZONE,
    );
    const chartEndYmd = ymdInIncomeTimeZone(
      currentIncome.periodEnd,
      EARNINGS_PAYMENT_INCOME_TIMEZONE,
    );
    const chartDays = enumerateInclusiveDaysYmd(chartStartYmd, chartEndYmd);
    const earnings: EarningsDataPoint[] = chartDays.map((date) => ({
      date,
      amount: dayAmount.get(date) ?? 0,
    }));

    let previousTotal: number | undefined;
    if (previousIncome) {
      previousTotal = primaryAmountFromUnits(
        previousIncome.TotalIncome.Units,
        network,
        amountUnit,
      );
    }

    return contractJsonResponse(contract, "GET", 200, {
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
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load earnings",
    });
  }
}
