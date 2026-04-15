export type ResolvedEarningsPeriod = {
  startDate: string;
  endDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  timeZone: string;
};

export type MeaningfulEarningsSeriesPoint = {
  amount: number;
  blockchainFees: number;
  units: Array<{ amount: number }>;
};

function formatCalendarDateLabel(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function calendarDateInTimeZoneYmd(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-iso8601", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function addUtcCalendarDays(ymd: string, deltaDays: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const ms = Date.UTC(year, month - 1, day) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function getDefaultCustomDates(timeZone: string): {
  startDate: string;
  endDate: string;
} {
  const endDate = calendarDateInTimeZoneYmd(new Date(), timeZone);
  return {
    startDate: addUtcCalendarDays(endDate, -30),
    endDate,
  };
}

export function formatResolvedEarningsPeriodLabel(
  period: ResolvedEarningsPeriod,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: period.timeZone,
  });

  const startLabel = period.periodStart
    ? formatter.format(new Date(period.periodStart))
    : formatCalendarDateLabel(period.startDate);
  const endLabel = period.periodEnd
    ? formatter.format(new Date(period.periodEnd))
    : formatCalendarDateLabel(period.endDate);

  return `${startLabel} – ${endLabel}`;
}

export function isMeaningfulEarningsSeriesPoint(
  point: MeaningfulEarningsSeriesPoint,
): boolean {
  return (
    point.amount > 0 ||
    point.blockchainFees > 0 ||
    point.units.some((unit) => unit.amount > 0)
  );
}

export function filterMeaningfulEarningsSeries<
  T extends MeaningfulEarningsSeriesPoint,
>(points: T[]): T[] {
  return points.filter(isMeaningfulEarningsSeriesPoint);
}
