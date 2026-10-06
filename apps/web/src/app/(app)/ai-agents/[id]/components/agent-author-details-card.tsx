"use client";

import { Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgentDisplayMetadataFields } from "@/lib/agents/parse-agent-display-metadata";
import { type Agent } from "@/lib/api/agent.client";
import { useSession } from "@/lib/auth/auth.client";

import {
  DetailRow,
  isRegistryAuthorSignedInUser,
} from "./agent-details-metadata-ui";

export function AgentAuthorDetailsCard({
  agent,
}: {
  agent: Pick<Agent, "metadata">;
}) {
  const t = useTranslations("App.Agents.Details");
  const { data: session } = useSession();
  const fields = getAgentDisplayMetadataFields(agent.metadata);

  const hasAuthorContent =
    Boolean(fields.authorName) ||
    Boolean(fields.authorEmail) ||
    Boolean(fields.organization) ||
    Boolean(fields.contactOther);

  if (!hasAuthorContent) {
    return null;
  }

  const showYouBesideName = isRegistryAuthorSignedInUser({
    authorEmail: fields.authorEmail,
    authorName: fields.authorName,
    sessionEmail: session?.user?.email,
    sessionName: session?.user?.name,
  });

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border/50 !p-4">
        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <CardTitle className="text-base font-semibold leading-none">
          {t("authorCardTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-6 py-5">
        {fields.authorName ? (
          <DetailRow label={t("authorName")}>
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
              <span>{fields.authorName}</span>
              {showYouBesideName ? (
                <span className="text-muted-foreground">{t("authorYou")}</span>
              ) : null}
            </span>
          </DetailRow>
        ) : null}
        {fields.authorEmail ? (
          <DetailRow label={t("authorEmail")}>
            <Link
              href={`mailto:${fields.authorEmail}`}
              className="inline-flex items-center gap-1 break-all hover:underline"
            >
              {fields.authorEmail}
              <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </Link>
          </DetailRow>
        ) : null}
        {fields.organization ? (
          <DetailRow label={t("organization")}>{fields.organization}</DetailRow>
        ) : null}
        {fields.contactOther ? (
          <DetailRow label={t("contactOther")}>
            <span className="whitespace-pre-wrap break-words">
              {fields.contactOther}
            </span>
          </DetailRow>
        ) : null}
      </CardContent>
    </Card>
  );
}
