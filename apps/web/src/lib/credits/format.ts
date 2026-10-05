export function formatCreditAmount(value: number): string {
  const safe = Math.max(0, value);
  const rounded = Math.round(safe * 10) / 10;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(rounded);
}
