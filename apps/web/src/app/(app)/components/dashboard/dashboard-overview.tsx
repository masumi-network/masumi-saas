import {
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Key,
  ShieldCheck,
  Wallet,
} from "lucide-react";
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
import { getGreeting } from "@/lib/utils";

import {
  getRegistrationStatusBadgeVariant,
  parseAgentRegistrationStatus,
} from "../../agents/components/agent-utils";
import { DashboardCreateApiKeyButton } from "./create-api-key-dialog";
import { DashboardRegisterAgentButton } from "./dashboard-register-agent-button";

function formatBalance(value: string): string {
  const num = parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default async function DashboardOverview({
  data,
}: {
  data: DashboardOverview;
}) {
  const t = await getTranslations("App.Home.Dashboard");

  const {
    user,
    kycStatus,
    kycError,
    agents,
    apiKeys,
    organizationCount,
    apiKeyCount,
    agentCount,
    verifiedAgentCount,
    balance,
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
    <div className="space-y-8">
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

      {/* Stats grid - Balance, Agents, Organizations */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
        {/* Balance - primary accent, prominent CTA - full width on mobile */}
        <Card
          className="group relative col-span-2 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--color-masumi-crimson-purple)]/5 to-transparent transition-all hover:shadow-lg hover:shadow-primary/5 lg:col-span-1"
          role="group"
          aria-label={`${t("stats.balance")}: ${formatBalance(balance)}`}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-masumi-electric-pink)] transition-colors group-hover:bg-[var(--color-masumi-vivid-sakura)]"
            aria-hidden
          />
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("stats.balance")}
            </CardTitle>
            <div className="rounded-lg bg-[var(--color-masumi-electric-pink)]/10 p-2 transition-colors group-hover:bg-[var(--color-masumi-electric-pink)]/20">
              <Wallet className="h-4 w-4 text-[var(--color-masumi-electric-pink)]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight">
              {formatBalance(balance)}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              {t("stats.balanceDescription")}
            </p>
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                className="h-9 bg-[var(--color-masumi-electric-pink)] font-medium text-white hover:bg-[var(--color-masumi-vivid-sakura)]"
              >
                <Link href="/top-up">{t("stats.topUp")}</Link>
              </Button>
              {parseFloat(balance || "0") <= 0 ? (
                <Button size="sm" variant="outline" className="h-9" disabled>
                  {t("stats.withdraw")}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline" className="h-9">
                  <Link href="/withdraw">{t("stats.withdraw")}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agents */}
        <Link
          href="/agents"
          aria-label={t("stats.agentsCardAria", { count: agentCount })}
        >
          <Card className="group h-full rounded-xl border border-border/80 transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("stats.agents")}
              </CardTitle>
              <div className="rounded-lg bg-muted p-2 transition-colors group-hover:bg-primary/10">
                <Bot className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                {agentCount}
                {verifiedAgentCount > 0 && (
                  <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">
                    {t("stats.agentsVerifiedCount", {
                      count: verifiedAgentCount,
                    })}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("stats.agentsDescription")}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Organizations */}
        <Link
          href="/organizations"
          aria-label={t("stats.organizationsCardAria", {
            count: organizationCount,
          })}
        >
          <Card className="group h-full rounded-xl border border-border/80 transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("stats.organizations")}
              </CardTitle>
              <div className="rounded-lg bg-muted p-2 transition-colors group-hover:bg-primary/10">
                <Building2 className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
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
        <div className="flex items-center justify-between gap-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("startKycPrompt")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/onboarding" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("startKyc")}
            </Link>
          </Button>
        </div>
      )}

      {/* Get started checklist - for new users */}
      {isNewUser && (
        <Card className="rounded-lg border-amber-500/15 bg-amber-500/5 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">{t("getStarted.title")}</CardTitle>
            <CardDescription>{t("getStarted.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                {user.emailVerified ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {t("getStarted.step1")}
                  </span>
                )}
                <span
                  className={`flex-1 text-sm ${user.emailVerified ? "text-muted-foreground" : ""}`}
                >
                  {!user.emailVerified
                    ? t("getStarted.verifyEmail")
                    : t("getStarted.verifyEmailDone")}
                </span>
                {!user.emailVerified && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/account">{t("getStarted.doIt")}</Link>
                  </Button>
                )}
              </li>
              <li className="flex items-center gap-3">
                {isKycCompleted ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {t("getStarted.step2")}
                  </span>
                )}
                <span
                  className={`flex-1 text-sm ${isKycCompleted ? "text-muted-foreground" : ""}`}
                >
                  {kycError
                    ? t("kycLoadError")
                    : needsKycAction
                      ? t("getStarted.completeKyc")
                      : t("getStarted.completeKycDone")}
                </span>
                {needsKycAction && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/onboarding">{t("getStarted.doIt")}</Link>
                  </Button>
                )}
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {t("getStarted.step3")}
                </span>
                <span className="flex-1 text-sm">
                  {t("getStarted.createOrg")}
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/organizations">{t("getStarted.doIt")}</Link>
                </Button>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {t("getStarted.step4")}
                </span>
                <span className="flex-1 text-sm">
                  {t("getStarted.registerAgent")}
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/agents">{t("getStarted.doIt")}</Link>
                </Button>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Agents and API Keys - same row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agents section */}
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>{t("stats.agents")}</CardTitle>
                <CardDescription>
                  {t("agentsSectionDescription")}
                </CardDescription>
              </div>
              {agentCount > 0 && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agents" className="flex items-center gap-1">
                    {t("viewAll")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TODO: Make agent rows navigable - wrap each item in Link to /agents/[id] and use agentLinkAria for accessibility */}
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Bot className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  {t("noAgentsYet")}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Bot className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="font-medium">{agent.name}</p>
                      </div>
                      <Badge
                        variant={
                          agent.verificationStatus === "VERIFIED"
                            ? "default"
                            : getRegistrationStatusBadgeVariant(
                                agent.registrationState as Agent["registrationState"],
                              )
                        }
                        className="capitalize"
                      >
                        {agent.verificationStatus === "VERIFIED"
                          ? "Verified"
                          : parseAgentRegistrationStatus(
                              agent.registrationState as Agent["registrationState"],
                            )}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <DashboardRegisterAgentButton />
          </CardContent>
        </Card>

        {/* API Keys section */}
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>{t("stats.apiKeys")}</CardTitle>
                <CardDescription>
                  {t("apiKeysSectionDescription")}
                </CardDescription>
              </div>
              {apiKeyCount > 0 && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/api-keys" className="flex items-center gap-1">
                    {t("viewAll")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
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
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
        <Skeleton className="col-span-2 h-40 rounded-xl lg:col-span-1" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
