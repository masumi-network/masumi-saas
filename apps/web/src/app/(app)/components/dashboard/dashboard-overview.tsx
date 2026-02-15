import { Bot, ChevronRight, Key, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Agent } from "@/lib/api/agent.client";
import type { DashboardOverview } from "@/lib/types/dashboard";
import { cn, getGreeting } from "@/lib/utils";

import {
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusKey,
} from "../../agents/components/agent-utils";
import { DashboardCreateApiKeyButton } from "./create-api-key-dialog";
import { DashboardRegisterAgentButton } from "./dashboard-register-agent-button";
import { DashboardRevenueCard } from "./dashboard-revenue-card";
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

  const {
    user,
    kycStatus,
    kycError,
    agents,
    apiKeys,
    organizationCount,
    apiKeyCount,
    agentCount,
  } = data;

  const userName = user.name || user.email || "User";
  const greeting = getGreeting();
  const isNewUser =
    organizationCount === 0 && apiKeyCount === 0 && agentCount === 0;
  const isKycCompleted = kycStatus === "APPROVED" || kycStatus === "VERIFIED";
  const needsKycAction =
    !kycError &&
    (kycStatus === "PENDING" ||
      kycStatus === "REVIEW" ||
      kycStatus === "REJECTED" ||
      kycStatus === "REVOKED" ||
      kycStatus === "EXPIRED");
  const showStartKycCta = needsKycAction;

  return (
    <div className="animate-in fade-in duration-300 min-w-0 space-y-8">
      {/* Greeting & subtitle */}
      <div className="space-y-1">
        <h2 className="text-2xl font-light tracking-tight text-foreground">
          {t("greeting", {
            time: greeting,
            name: userName.split(" ")[0] || userName,
          })}
        </h2>
        <p className="text-muted-foreground text-sm leading-6">
          {t("subtitle")}
        </p>
      </div>

      {/* Stats grid - Revenue, Agents, Organizations */}
      <div className="grid min-w-0 grid-cols-2 gap-5 lg:grid-cols-3">
        <DashboardRevenueCard />

        {/* Agents */}
        <Card className="group h-full rounded-xl border border-border/80 transition-all duration-200 hover:border-primary/30 hover:shadow-md">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground">
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

        {/* Organizations */}
        <Link
          href="/organizations"
          aria-label={t("stats.organizationsCardAria", {
            count: organizationCount,
          })}
        >
          <Card className="group h-full rounded-xl border border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground transition-colors hover:underline">
                {t("stats.organizations")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                {organizationCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("stats.organizationsDescription")}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* KYC load error - when lookup failed */}
      {kycError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("kycLoadError")}</p>
        </div>
      )}

      {/* Start KYC CTA - compact banner when KYC not submitted */}
      {showStartKycCta && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("startKycPrompt")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/verification" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("startKyc")}
            </Link>
          </Button>
        </div>
      )}

      {/* Get started checklist - for new users */}
      {isNewUser && (
        <GetStartedCard
          user={{ emailVerified: user.emailVerified }}
          isKycCompleted={isKycCompleted}
          kycError={kycError}
          needsKycAction={needsKycAction}
        />
      )}

      {/* Agents and API Keys - same row */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Agents section */}
        <Card className="min-w-0 overflow-hidden rounded-lg shadow-none">
          <CardHeader>
            <div className="min-w-0 space-y-1.5">
              <Link
                href="/agents"
                className="inline-flex items-center gap-1 leading-none font-semibold hover:underline"
              >
                {t("agentsSectionTitle")}
                <ChevronRight className="h-4 w-4" />
              </Link>
              <CardDescription>{t("agentsSectionDescription")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Bot className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  {t("noAgentsYet")}
                </p>
              </div>
            ) : (
              <ul className="min-w-0 space-y-3">
                {agents.map((agent) => (
                  <li key={agent.id} className="min-w-0">
                    <Link
                      href={`/agents/${agent.id}?from=dashboard`}
                      aria-label={t("agentLinkAria", { name: agent.name })}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                    >
                      <p
                        className="min-w-0 truncate text-sm font-medium"
                        title={agent.name}
                      >
                        {agent.name}
                      </p>
                      <Badge
                        variant={
                          agent.verificationStatus === "VERIFIED"
                            ? "outline-muted"
                            : getRegistrationStatusBadgeVariant(
                                agent.registrationState as Agent["registrationState"],
                              )
                        }
                        className={cn(
                          "min-w-fit shrink-0 capitalize",
                          agent.registrationState === "RegistrationConfirmed" &&
                            "border border-green-200 bg-green-50 text-green-700 hover:bg-green-50/80 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50",
                        )}
                      >
                        {agent.verificationStatus === "VERIFIED"
                          ? "Verified"
                          : tRegistrationStatus(
                              getRegistrationStatusKey(
                                agent.registrationState as Agent["registrationState"],
                              ),
                            )}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <DashboardRegisterAgentButton />
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
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Key className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  {t("noApiKeysYet")}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {apiKeys.map((key) => (
                  <li key={key.id}>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Key className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="font-medium">
                          {key.name || key.prefix || "API Key"}
                        </p>
                      </div>
                      {key.prefix && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {key.prefix}…
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

      {/* Stats grid - Revenue, Agents, Organizations */}
      <div className="grid min-w-0 grid-cols-2 gap-5 lg:grid-cols-3">
        {/* Revenue card */}
        <Card className="col-span-2 overflow-hidden rounded-xl pt-0 lg:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 rounded-t-xl bg-masumi-gradient pb-2 pt-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-1 h-9 w-24" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
        {/* Agents card */}
        <Card className="h-full rounded-xl border border-border/80">
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-14" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-12" />
            <Skeleton className="mt-1 h-3 w-24" />
          </CardContent>
        </Card>
        {/* Organizations card */}
        <Card className="h-full rounded-xl border border-border/80">
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-8" />
            <Skeleton className="mt-1 h-3 w-28" />
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
