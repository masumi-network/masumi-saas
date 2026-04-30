import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { getAdminAgentDetail } from "@/lib/api/admin.server";
import { formatDate } from "@/lib/utils";

type PageProps = {
  params: Promise<{ agentId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { agentId } = await params;
  const result = await getAdminAgentDetail(agentId);
  const t = await getTranslations("Admin.Agents.agentDetail");
  if (!result.success) {
    return { title: `Masumi - ${t("notFoundTitle")}` };
  }
  return {
    title: `Masumi - ${result.agent.name}`,
    description: t("metaDescription", { name: result.agent.name }),
  };
}

export default async function AdminAgentDetailPage({ params }: PageProps) {
  const { agentId } = await params;
  const result = await getAdminAgentDetail(agentId);
  const t = await getTranslations("Admin.Agents.agentDetail");
  const tList = await getTranslations("Admin.Agents");

  if (!result.success) {
    notFound();
  }

  const agent = result.agent;

  const registrationLabel = (() => {
    const state = agent.registrationState as string;
    const map: Record<string, string> = {
      RegistrationConfirmed: tList("registrationConfirmed"),
      RegistrationRequested: tList("registrationRequested"),
      RegistrationInitiated: tList("registrationInitiated"),
      RegistrationFailed: tList("registrationFailed"),
      DeregistrationRequested: tList("deregistrationRequested"),
      DeregistrationInitiated: tList("deregistrationInitiated"),
      DeregistrationConfirmed: tList("deregistrationConfirmed"),
      DeregistrationFailed: tList("deregistrationFailed"),
    };
    return map[state] ?? state;
  })();

  const verificationLabel = (() => {
    const status = agent.verificationStatus;
    if (!status) return tList("verificationPending");
    const map: Record<string, string> = {
      PENDING: tList("verificationPending"),
      VERIFIED: tList("verificationVerified"),
      REVOKED: tList("verificationRevoked"),
      EXPIRED: tList("verificationExpired"),
    };
    return map[status] ?? status;
  })();

  return (
    <div className="space-y-6 animate-page-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
            <Link href="/admin/agents">{t("backToList")}</Link>
          </Button>
          <h1 className="text-3xl font-light tracking-tight">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href={`/ai-agents/${agent.id}`}>{t("openInApp")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("overviewTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {tList("agentIdentifier")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-sm">
                  {agent.agentIdentifier ?? "—"}
                </span>
                {agent.agentIdentifier ? (
                  <CopyButton value={agent.agentIdentifier} />
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {tList("status")}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-normal">
                  {registrationLabel}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {verificationLabel}
                </Badge>
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                {tList("owner")}
              </p>
              <p className="mt-1 text-sm">{agent.ownerName}</p>
              <p className="text-sm text-muted-foreground">
                {agent.ownerEmail}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("apiUrl")}
              </p>
              <p className="mt-1 break-all font-mono text-sm">{agent.apiUrl}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {tList("createdAt")}
              </p>
              <p className="mt-1 text-sm">{formatDate(agent.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
