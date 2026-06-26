export function formatX402Amount(
  amount: string | null | undefined,
  decimals: number = 18,
): string {
  if (amount == null || amount === "") return "—";
  let value: bigint;
  try {
    value = BigInt(amount);
  } catch {
    return amount;
  }
  if (decimals <= 0) return value.toString();

  const zero = BigInt(0);
  const negative = value < zero;
  const abs = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = (abs / base).toString();
  const fraction = (abs % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  const formatted = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}

export function groupDigits(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  if (!/^-?\d+$/.test(value)) return value;
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
  return negative ? `-${digits}` : digits;
}
