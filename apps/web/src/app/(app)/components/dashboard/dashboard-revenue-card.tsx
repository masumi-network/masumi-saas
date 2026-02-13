"use client";

import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimePeriod = "24h" | "7d" | "30d" | "all";

const PLACEHOLDER_EARNINGS: Record<TimePeriod, string> = {
  "24h": "5548",
  "7d": "42000",
  "30d": "120670",
  all: "1821992",
};

function formatRevenue(value: string): string {
  const num = parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

interface DashboardRevenueCardProps {
  revenue: string;
}

export function DashboardRevenueCard({
  revenue: _revenue,
}: DashboardRevenueCardProps) {
  const t = useTranslations("App.Home.Dashboard.stats");
  const [period, setPeriod] = useState<TimePeriod>("7d");

  // TODO: Fetch revenue by period when payment/earnings API is wired
  const displayRevenue = PLACEHOLDER_EARNINGS[period];

  return (
    <Card
      className="group relative col-span-2 overflow-hidden rounded-xl pt-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 lg:col-span-1"
      role="group"
      aria-label={`${t("earnings")}: ${formatRevenue(displayRevenue)}`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 rounded-t-xl bg-masumi-gradient pb-2 pt-6">
        <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground">
          {t("earnings")}
        </CardTitle>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as TimePeriod)}
        >
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="24h">{t("period24h")}</SelectItem>
            <SelectItem value="7d">{t("period7d")}</SelectItem>
            <SelectItem value="30d">{t("period30d")}</SelectItem>
            <SelectItem value="all">{t("periodAll")}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="relative">
        {/* TODO: Replace with real earnings data when payment/earnings API is wired */}
        {/* Mini line chart - bottom right, no axes */}
        <div
          className="absolute right-0 bottom-0 h-30 w-full opacity-40 pointer-events-none"
          aria-hidden
        >
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <defs>
              <linearGradient
                id="earnings-chart-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0.2"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <path
              d="M 0 32 Q 12 30 25 28 T 50 24 T 75 22 T 100 18 L 100 40 L 0 40 Z"
              fill="url(#earnings-chart-gradient)"
            />
            <path
              d="M 0 32 Q 12 30 25 28 T 50 24 T 75 22 T 100 18"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth=".5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight relative">
          {formatRevenue(displayRevenue)}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          {t("earningsDescription")}
        </p>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-9 gap-2 relative backdrop-blur-sm"
        >
          <Link href="/metrics">
            <TrendingUp className="h-4 w-4" />
            {t("viewMetrics")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
