"use client";

import {
  ArrowRight,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  Key,
  Plus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { OrganizationRoleBadge } from "@/components/organizations";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrganizationDashboardData } from "@/lib/actions/organization.action";
import type { Agent } from "@/lib/api/agent.client";
import { useOrganizationContext } from "@/lib/context/organization-context";
import {
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusKey,
  getVerificationStatusBadgeVariant,
  getVerificationStatusKey,
} from "@/lib/utils/agent-utils";

interface OrganizationDashboardOverviewProps {
  data: OrganizationDashboardData;
}

function getKybStatusVariant(
  status: string | null,
): "default" | "success" | "destructive" | "secondary" {
  switch (status) {
    case "VERIFIED":
    case "APPROVED":
      return "success";
    case "REJECTED":
    case "REVOKED":
    case "EXPIRED":
      return "destructive";
    case "REVIEW":
    case "PENDING":
    default:
      return "secondary";
  }
}

export function OrganizationDashboardOverview({
  data,
}: OrganizationDashboardOverviewProps) {
  const t = useTranslations("App.Organizations.Dashboard");
  const tSidebar = useTranslations("App.Sidebar.MenuItems");
  const tDetail = useTranslations("App.Organizations.Detail");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");
  const tStatus = useTranslations("App.Agents.status");

  const { activeOrganization } = useOrganizationContext();
  const {
    organization,
    kybStatus,
    agentCount,
    agents,
    apiKeyCount,
    activeApiKeyCount,
    apiKeys,
  } = data;

  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const isFromDashboard = fromParam === "dashboard";
  const backHref = isFromDashboard ? "/" : "/organizations";
  const backLabel = isFromDashboard ? tDetail("backToDashboard") : undefined;
  const breadcrumbLabel =
    backHref === "/" ? tSidebar("dashboard") : tSidebar("organizations");

  const isActive = activeOrganization?.id === organization.id;
  const slugDisplay = `@${organization.slug}`;

  return (
    <div className="animate-in fade-in duration-300 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              asChild
              className="-ml-2 h-8 w-8 shrink-0 rounded-full"
            >
              <Link href={backHref}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{backLabel ?? tDetail("back")}</TooltipContent>
        </Tooltip>
        <Link
          href={backHref}
          className="text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          {breadcrumbLabel}
        </Link>
      </div>

      {/* organization header */}

      {/* Organization info card */}
      <Card className="bg-muted-surface/30 py-4 sm:py-6">
        <CardHeader className="rounded-t-xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">{organization.name}</CardTitle>
                <CardDescription>{slugDisplay}</CardDescription>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4"></div>
              <div className="flex flex-wrap items-center gap-2">
                <OrganizationRoleBadge role={organization.role} />
                {isActive && (
                  <Badge variant="default">{tDetail("current")}</Badge>
                )}
                {kybStatus && (
                  <Badge variant={getKybStatusVariant(kybStatus)}>
                    {t(`kybStatus.${kybStatus}`)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6">
          {/* Stats grid */}
          <div className="grid min-w-0 grid-cols-2 gap-5 lg:grid-cols-3">
            {/* Wallet balance */}
            <Card className="group col-span-2 lg:col-span-1 h-full rounded-xl bg-muted-surface pt-0">
              <CardHeader className="space-y-0 pb-2 bg-masumi-gradient pt-6">
                <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-tight text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  {t("stats.walletBalance")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                  {t("stats.walletBalanceValue")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("stats.walletBalanceDescription")}
                </p>
              </CardContent>
            </Card>

            {/* Linked agents */}
            <Link
              href="/ai-agents"
              aria-label={t("stats.linkedAgentsAria", { count: agentCount })}
            >
              <Card className="group h-full rounded-xl bg-muted-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <CardHeader className="space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-tight text-muted-foreground transition-colors group-hover:underline">
                    <Bot className="h-3.5 w-3.5" />
                    {t("stats.linkedAgents")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                    {agentCount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("stats.linkedAgentsDescription")}
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* API keys */}
            <Link
              href="/api-keys"
              aria-label={t("stats.apiKeysAria", { count: apiKeyCount })}
            >
              <Card className="group h-full rounded-xl bg-muted-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <CardHeader className="space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-tight text-muted-foreground transition-colors group-hover:underline">
                    <Key className="h-3.5 w-3.5" />
                    {t("stats.apiKeys")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                    {apiKeyCount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("stats.apiKeysDescription", {
                      active: activeApiKeyCount,
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-tight text-muted-foreground">
          {t("quickActions.title")}
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/payment-methods">
              <Plus className="h-4 w-4" />
              {t("quickActions.addPaymentMethod")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/api-keys">
              <Key className="h-4 w-4" />
              {t("quickActions.createApiKey")}
            </Link>
          </Button>
        </div>
      </div>
      {/* Linked agents & API Keys — same row */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Linked agents section */}
        <Card className="min-w-0 overflow-hidden rounded-lg shadow-none">
          <CardHeader>
            <div className="min-w-0 space-y-1.5">
              <Link
                href="/ai-agents"
                className="inline-flex items-center gap-1 leading-none font-semibold hover:underline"
              >
                {t("linkedAgentsSection.title")}
                <ChevronRight className="h-4 w-4" />
              </Link>
              <CardDescription>
                {t("linkedAgentsSection.description")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Bot className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  {t("linkedAgentsSection.empty")}
                </p>
              </div>
            ) : (
              <ul className="min-w-0 space-y-3">
                {agents.map((agent) => (
                  <li key={agent.id} className="min-w-0">
                    <Link
                      href={`/ai-agents/${agent.id}`}
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
                            ? getVerificationStatusBadgeVariant(
                                agent.verificationStatus as Agent["verificationStatus"],
                              )
                            : agent.registrationState ===
                                "RegistrationConfirmed"
                              ? "success"
                              : getRegistrationStatusBadgeVariant(
                                  agent.registrationState as Agent["registrationState"],
                                )
                        }
                        className="min-w-fit shrink-0 capitalize"
                      >
                        {agent.verificationStatus === "VERIFIED"
                          ? tStatus(
                              getVerificationStatusKey(
                                agent.verificationStatus as Agent["verificationStatus"],
                              ),
                            )
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
            {agentCount > 5 && (
              <Button variant="ghost" size="sm" asChild className="w-full">
                <Link href="/ai-agents">
                  {t("linkedAgentsSection.viewAll")}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
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
                {t("apiKeysSection.title")}
                <ChevronRight className="h-4 w-4" />
              </Link>
              <CardDescription>
                {t("apiKeysSection.description")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {apiKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Key className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  {t("apiKeysSection.empty")}
                </p>
              </div>
            ) : (
              <ul className="min-w-0 space-y-3">
                {apiKeys.map((key) => (
                  <li key={key.id} className="min-w-0">
                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Key className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p
                          className="min-w-0 truncate text-sm font-medium"
                          title={key.name}
                        >
                          {key.name}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {key.keyPrefix}…
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {apiKeyCount > 5 && (
              <Button variant="ghost" size="sm" asChild className="w-full">
                <Link href="/api-keys">
                  {t("apiKeysSection.viewAll")}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OrganizationDashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Organization info card */}
      <Card className="bg-muted-surface/30 py-4 sm:py-6">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Stats grid */}
          <div className="grid min-w-0 grid-cols-2 gap-5 lg:grid-cols-3">
            {/* Wallet balance */}
            <Card className="col-span-2 lg:col-span-1 overflow-hidden rounded-xl pt-0">
              <CardHeader className="bg-masumi-gradient pb-2 pt-6">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-1 h-9 w-20" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
            {/* Linked agents */}
            <Card className="h-full rounded-xl">
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-12" />
                <Skeleton className="mt-1 h-3 w-28" />
              </CardContent>
            </Card>
            {/* API keys */}
            <Card className="h-full rounded-xl">
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-16" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-12" />
                <Skeleton className="mt-1 h-3 w-20" />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-44 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Agents & API Keys grid */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-52" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-56" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
