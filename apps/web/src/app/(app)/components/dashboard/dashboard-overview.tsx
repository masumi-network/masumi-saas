import { Bot, ChevronRight, Key } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AgentVerifiedShield } from "@/components/agent-verified-shield";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardOverview } from "@/lib/types/dashboard";
import { formatPricingDisplay, getGreeting } from "@/lib/utils";
import {
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusKey,
} from "@/lib/utils/agent-utils";

import { DashboardCreateApiKeyButton } from "./create-api-key-dialog";
import { DashboardActivitySummaryCard } from "./dashboard-activity-summary-card";
import { DashboardOrgContextBanner } from "./dashboard-org-context-banner";
import { DashboardRegisterAgentButton } from "./dashboard-register-agent-button";
import { DashboardRevenueCard } from "./dashboard-revenue-card";
import { DashboardStatsMobileStrip } from "./dashboard-stats-mobile-strip";
import { GetStartedCard } from "./get-started-card";

export default async function DashboardOverview({
  data,
}: {
  data: DashboardOverview;
}) {
  const t = await getTranslations("App.Home.Dashboard");
  const tRegistrationStatus = await getTranslations(
    "App.Agents.registrationStatus",
  );

  const { user, agents, apiKeys, organizationCount, apiKeyCount, agentCount } =
    data;

  const userName = user.name || user.email || "User";
  const greeting = getGreeting();
  const isNewUser =
    organizationCount === 0 && apiKeyCount === 0 && agentCount === 0;

  return (
    <div className="min-w-0 space-y-8 animate-in fade-in duration-300">
      <PageHeader
        variant="display"
        title={t(`greeting.${greeting}`, {
          name: userName.split(" ")[0] || userName,
        })}
        description={t("subtitle")}
      />

      {/* Org context banner - shown when viewing as an org member */}
      <DashboardOrgContextBanner />

      {/* Stats grid - Revenue, Agents, Activity summary */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-0">
          <DashboardRevenueCard />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-75 md:hidden">
          <DashboardStatsMobileStrip agentCount={agentCount} />
        </div>
        <div className="hidden animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-75 md:block">
          <Link
            href="/ai-agents"
            aria-label={t("stats.agentsCardAria", { count: agentCount })}
          >
            <Card className="dashboard-stat-card group h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
              <CardHeader className="space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors group-hover:text-primary">
                  <Bot className="h-4 w-4 shrink-0" />
                  {t("stats.registeredAgents")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                  {agentCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("stats.registeredAgentsDescription")}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
        <div className="hidden animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-150 md:block">
          <DashboardActivitySummaryCard />
        </div>
      </div>

      {/* Get started checklist - for new users */}
      {isNewUser && (
        <GetStartedCard user={{ emailVerified: user.emailVerified }} />
      )}

      {/* Agents and API Keys - same row */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Agents section */}
        <Card className="min-w-0 overflow-hidden shadow-none">
          <CardHeader>
            <div className="min-w-0 space-y-1.5">
              <Link
                href="/ai-agents"
                className="inline-flex items-center gap-1 text-base font-semibold leading-none tracking-tight hover:text-primary hover:underline"
              >
                {t("agentsSectionTitle")}
                <ChevronRight className="h-4 w-4" />
              </Link>
              <CardDescription>{t("agentsSectionDescription")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted-surface/60 px-4 py-14">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-center text-sm font-medium text-foreground">
                  {t("noAgentsYet")}
                </p>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  {t("noAgentsYetDescription")}
                </p>
              </div>
            ) : (
              <ul className="min-w-0 space-y-3">
                {agents.map((agent, index) => (
                  <li
                    key={agent.id}
                    className="min-w-0 animate-table-row-in transition-[opacity] duration-150"
                    style={{
                      animationDelay: `${Math.min(index, 9) * 40}ms`,
                    }}
                  >
                    <Link
                      href={`/ai-agents/${agent.id}?from=dashboard`}
                      aria-label={t("agentLinkAria", { name: agent.name })}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/80 p-3.5 transition-all duration-200 hover:-translate-y-px hover:border-primary/20 hover:bg-muted/40 hover:shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p
                            className="min-w-0 truncate text-sm font-medium"
                            title={agent.name}
                          >
                            {agent.name}
                          </p>
                          {agent.verificationStatus === "VERIFIED" ? (
                            <AgentVerifiedShield className="-mt-px" />
                          ) : null}
                        </div>
                      </div>
                      <Badge
                        variant={getRegistrationStatusBadgeVariant(
                          agent.registrationState,
                        )}
                        className="shrink-0"
                      >
                        {tRegistrationStatus(
                          getRegistrationStatusKey(agent.registrationState),
                        )}
                      </Badge>
                      <span className="min-w-fit shrink-0 text-sm text-muted-foreground">
                        {formatPricingDisplay(agent.pricing)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <DashboardRegisterAgentButton agentCount={agentCount} />
          </CardContent>
        </Card>

        {/* API Keys section */}
        <Card className="min-w-0 overflow-hidden rounded-lg shadow-none">
          <CardHeader>
            <div className="min-w-0 space-y-1.5">
              <Link
                href="/api-keys"
                className="inline-flex items-center gap-1 leading-none font-semibold hover:underline"
              >
                {t("stats.apiKeys")}
                <ChevronRight className="h-4 w-4" />
              </Link>
              <CardDescription>
                {t("apiKeysSectionDescription")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted-surface/60 px-4 py-14">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Key className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-center text-sm font-medium text-foreground">
                  {t("noApiKeysYet")}
                </p>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  {t("noApiKeysYetDescription")}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {apiKeys.map((key, index) => (
                  <li
                    key={key.id}
                    className="animate-table-row-in transition-[opacity] duration-150"
                    style={{
                      animationDelay: `${Math.min(index, 9) * 40}ms`,
                    }}
                  >
                    <div className="flex items-center justify-between rounded-lg border border-border/80 p-3.5 transition-all duration-200 hover:-translate-y-px hover:border-primary/20 hover:bg-muted/40 hover:shadow-sm">
                      <p className="font-medium">
                        {key.name || key.start || key.prefix || "API Key"}
                      </p>
                      {(key.start ?? key.prefix) && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {key.start ?? key.prefix}…
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <DashboardCreateApiKeyButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-8">
      {/* Greeting & subtitle */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Stats grid - Revenue, Agents, Activity summary */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {/* Revenue card */}
        <Card className="overflow-hidden rounded-xl pt-0 md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 rounded-t-xl bg-masumi-gradient pb-2 pt-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-1 h-9 w-24" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
        {/* Mobile stats strip */}
        <div className="flex divide-x divide-border/80 overflow-hidden rounded-xl border border-border/80 md:hidden">
          <div className="flex flex-1 items-center justify-center gap-2 px-3 py-3">
            <Skeleton className="h-8 w-8 shrink-0" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 px-3 py-3">
            <Skeleton className="h-8 w-8 shrink-0" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        {/* Agents card */}
        <Card className="hidden h-full rounded-xl border border-border/80 md:block">
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-14" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-12" />
            <Skeleton className="mt-1 h-3 w-24" />
          </CardContent>
        </Card>
        {/* Activity summary card */}
        <Card className="hidden h-full rounded-xl border border-border/80 md:block">
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-12" />
            <Skeleton className="mt-1 h-3 w-36" />
          </CardContent>
        </Card>
      </div>

      {/* Agents and API Keys - 2-col grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-56" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
