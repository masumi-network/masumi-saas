const creditFormatter = new Intl.NumberFormat("en-US");

export function formatCreditAmount(value: number): string {
  return creditFormatter.format(Math.max(0, value));
}
