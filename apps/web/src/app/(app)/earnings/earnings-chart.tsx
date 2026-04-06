"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardEarningsAmountUnit } from "@/lib/payment-node/format";
import { formatDashboardEarningsTotal } from "@/lib/payment-node/format";

export type EarningsChartPoint = { date: string; amount: number };

type ChartRow = EarningsChartPoint & { time: number };

function toChartRows(data: EarningsChartPoint[]): ChartRow[] {
  return [...data]
    .map((d) => ({
      ...d,
      time: new Date(`${d.date}T12:00:00.000Z`).getTime(),
    }))
    .sort((a, b) => a.time - b.time);
}

type EarningsChartProps = {
  data: EarningsChartPoint[];
  amountUnit: DashboardEarningsAmountUnit;
};

function formatAxisAmount(value: number, unit: DashboardEarningsAmountUnit) {
  if (unit === "USD") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
    if (value >= 1) return `$${value.toFixed(0)}`;
    return `$${value.toFixed(2)}`;
  }
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value.toFixed(2)}`;
}

export function EarningsChart({ data, amountUnit }: EarningsChartProps) {
  const baseId = useId().replace(/:/g, "");
  const fillId = `earnings-fill-${baseId}`;
  const chartData = useMemo(() => toChartRows(data), [data]);

  return (
    <div className="h-[min(22rem,55vh)] w-full min-h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border/60"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            minTickGap={28}
            tickFormatter={(value: number) =>
              new Date(value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={amountUnit === "USD" ? 52 : 58}
            tickFormatter={(v: number) => formatAxisAmount(v, amountUnit)}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const raw = payload[0]?.value;
              const amount = typeof raw === "number" ? raw : Number(raw);
              if (Number.isNaN(amount)) return null;
              const ts =
                typeof label === "number"
                  ? label
                  : typeof label === "string"
                    ? new Date(`${label}T12:00:00.000Z`).getTime()
                    : NaN;
              if (Number.isNaN(ts)) return null;
              const day = new Date(ts);
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                  <p className="text-muted-foreground text-xs">
                    {day.toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="font-mono text-base font-semibold tabular-nums">
                    {formatDashboardEarningsTotal(amount, amountUnit)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill={`url(#${fillId})`}
            fillOpacity={1}
            isAnimationActive={chartData.length < 120}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
