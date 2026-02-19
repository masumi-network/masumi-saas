import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

export type EarningsDataPoint = {
  date: string;
  amount: number;
};

export type EarningsApiResponse =
  | { success: true; data: { earnings: EarningsDataPoint[]; total: number } }
  | { success: false; error: string };

const VALID_PERIODS = ["24h", "7d", "30d", "all"] as const;

export async function GET(request: Request) {
  try {
    await getAuthenticatedOrThrow();

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

    return NextResponse.json({
      success: true,
      data: { earnings, total },
    });
  } catch (error) {
    const isUnauthorized =
      error instanceof Error && error.message === "Unauthorized";
    const status = isUnauthorized ? 401 : 500;
    if (!isUnauthorized) {
      console.error("Failed to get earnings:", error);
    }
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load earnings",
      },
      { status },
    );
  }
}
