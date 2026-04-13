import type { DashboardEarningsAmountUnit } from "@/lib/payment-node/format";

export type EarningsChartPoint = { date: string; amount: number };

export type FetchEarningsForPeriodResult =
  | {
      ok: true;
      earnings: EarningsChartPoint[];
      total: number;
      amountUnit: DashboardEarningsAmountUnit;
      previousTotal?: number;
      previousComparisonUnavailable?: boolean;
    }
  | { ok: false; error: string };

/**
 * GET /api/earnings — shared by dashboard card and earnings page.
 * Pass `genericErrorMessage` for translated copy on network/parse failures and empty API errors.
 */
export async function fetchEarningsForPeriod(
  period: string,
  network: string,
  options?: { genericErrorMessage?: string },
): Promise<FetchEarningsForPeriodResult> {
  const fallback = options?.genericErrorMessage ?? "Failed to load earnings";

  try {
    const q = new URLSearchParams({
      period,
      network,
    });
    const res = await fetch(`/api/earnings?${q.toString()}`);
    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
      data?: {
        earnings?: EarningsChartPoint[];
        total?: number;
        amountUnit?: DashboardEarningsAmountUnit;
        previousTotal?: number;
        previousComparisonUnavailable?: boolean;
      };
    };

    if (!json.success) {
      const apiErr =
        typeof json.error === "string" && json.error.trim()
          ? json.error
          : fallback;
      return { ok: false, error: apiErr };
    }

    return {
      ok: true,
      earnings: json.data?.earnings ?? [],
      total: json.data?.total ?? 0,
      amountUnit: json.data?.amountUnit ?? "USD",
      previousTotal: json.data?.previousTotal,
      previousComparisonUnavailable: json.data?.previousComparisonUnavailable,
    };
  } catch {
    return { ok: false, error: fallback };
  }
}
