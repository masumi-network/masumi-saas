import type { PaymentIncomeOutput } from "@/lib/payment-node/schemas";

/**
 * Sum payment-node `Units` arrays (same shape as `TotalIncome.Units`) across multiple
 * `getPaymentIncome` responses.
 */
export function mergeIncomeUnitRows(
  parts: Array<Array<{ unit: string; amount: number }>>,
): Array<{ unit: string; amount: number }> {
  const byUnit = new Map<string, number>();
  for (const units of parts) {
    for (const u of units) {
      byUnit.set(u.unit, (byUnit.get(u.unit) ?? 0) + u.amount);
    }
  }
  return [...byUnit.entries()].map(([unit, amount]) => ({ unit, amount }));
}

/**
 * Merge per-day `DailyIncome` rows from several agents into one map of YYYY-MM-DD → merged units.
 */
export function mergeDailyIncomeByDay(
  incomes: PaymentIncomeOutput[],
  dayKey: (d: { day: number; month: number; year: number }) => string,
): Map<string, Array<{ unit: string; amount: number }>> {
  const byDay = new Map<string, Array<{ unit: string; amount: number }>>();
  for (const inc of incomes) {
    for (const row of inc.DailyIncome) {
      const key = dayKey(row);
      const prev = byDay.get(key) ?? [];
      byDay.set(key, mergeIncomeUnitRows([prev, row.Units]));
    }
  }
  return byDay;
}
