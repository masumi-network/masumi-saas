import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

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
        /** Previous period total for trend (e.g. prior 7 days when period=7d). */
        previousTotal?: number;
      };
    }
  | { success: false; error: string };

const VALID_PERIODS = ["24h", "7d", "30d", "all"] as const;

export async function GET(request: Request) {
  try {
    await getAuthenticatedOrThrow(request);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "7d";
    // Period will be used when real earnings data is integrated
    const _validPeriod = VALID_PERIODS.includes(
      period as (typeof VALID_PERIODS)[number],
    )
      ? (period as (typeof VALID_PERIODS)[number])
      : "7d";

    // TODO: Integrate real earnings from payment service
    // For now return zero earnings; the array structure is ready for line graph
    const earnings: EarningsDataPoint[] = [];
    const total = earnings.reduce((sum, p) => sum + p.amount, 0);
    // Omit previousTotal when no prior data — undefined = "no data", 0 = "zero earnings in prior period"
    return NextResponse.json({
      success: true,
      data: { earnings, total },
    });
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
