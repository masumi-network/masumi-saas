import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  type DashboardEarningsAmountUnit,
  dashboardEarningsUnitFromTotals,
  type Network,
  splitIncomeUnitsStablecoinUsdAndAda,
} from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { type EarningsPeriod, earningsQuerySchema } from "@/lib/schemas";

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

function enumerateInclusiveDaysUTC(
  startDate: string,
  endDate: string,
): string[] {
  const out: string[] = [];
  const cur = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
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
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);

  if (period === "all") {
    return {
      current: { startDate: "2020-01-01", endDate: endStr },
      previous: null,
    };
  }

  let days = 7;
  if (period === "24h") days = 1;
  else if (period === "7d") days = 7;
  else if (period === "30d") days = 30;

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const startStr = start.toISOString().slice(0, 10);

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);
  const prevStartStr = prevStart.toISOString().slice(0, 10);

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
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

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

    const client = await getPaymentNodeClientForUser(user.id);
    if (!client) {
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

    const [currentIncome, previousIncome] = await Promise.all([
      client.getPaymentIncome({
        network,
        agentIdentifier: null,
        startDate: current.startDate,
        endDate: current.endDate,
        timeZone: "Etc/UTC",
      }),
      previous
        ? client.getPaymentIncome({
            network,
            agentIdentifier: null,
            startDate: previous.startDate,
            endDate: previous.endDate,
            timeZone: "Etc/UTC",
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

    const days = enumerateInclusiveDaysUTC(current.startDate, current.endDate);
    const earnings: EarningsDataPoint[] = days.map((date) => ({
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
