"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Agent } from "@/lib/api/agent.client";

type TimePeriod = "1d" | "7d" | "30d" | "all";

interface AgentEarningsProps {
  agent: Agent;
}

export function AgentEarnings({ agent: _agent }: AgentEarningsProps) {
  const t = useTranslations("App.Agents.Details.Earnings");
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1d");

  // Placeholder: Earnings data will be fetched when payment service API is wired.
  // agent.apiUrl will be used as agentIdentifier for the payment service.
  const earningsData = null;
  const isLoading = false;
  const error = null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">
            {t("loading")}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card className="overflow-hidden gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 bg-masumi-gradient rounded-t-xl pt-6 p-6">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </span>
            {t("title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}
            >
              <SelectTrigger className="w-42">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="1d">{t("period1d")}</SelectItem>
                <SelectItem value="7d">{t("period7d")}</SelectItem>
                <SelectItem value="30d">{t("period30d")}</SelectItem>
                <SelectItem value="all">{t("periodAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {earningsData ? (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  {/* Earnings would be rendered here when API is wired */}
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <Badge variant="secondary" className="font-medium">
                  {/* Transaction count would go here */}
                </Badge>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {t("noEarningsData")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
