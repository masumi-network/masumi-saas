"use client";

import {
  Cpu,
  ExternalLink,
  FileOutput,
  Link2,
  Mail,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAgentDisplayMetadataFields } from "@/lib/agents/parse-agent-display-metadata";
import { type Agent } from "@/lib/api/agent.client";

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm text-foreground sm:text-right">
        {children}
      </div>
    </div>
  );
}

function ExternalUrl({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 break-all font-mono text-xs hover:underline sm:justify-end"
    >
      <span className="min-w-0 truncate">{label ?? href}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </Link>
  );
}

export function AgentCapabilitiesDetailsCard({
  agent,
}: {
  agent: Pick<Agent, "metadata">;
}) {
  const t = useTranslations("App.Agents.Details");
  const tRegister = useTranslations("App.Agents.Register");

  const fields = getAgentDisplayMetadataFields(agent.metadata);

  const hasCapability =
    Boolean(fields.capabilityName) || Boolean(fields.capabilityVersion);
  const hasContact =
    Boolean(fields.authorName) ||
    Boolean(fields.authorEmail) ||
    Boolean(fields.organization) ||
    Boolean(fields.contactOther);
  const hasLinks =
    Boolean(fields.termsOfUseUrl) ||
    Boolean(fields.privacyPolicyUrl) ||
    Boolean(fields.otherUrl);
  const hasExamples = fields.exampleOutputs.length > 0;
  const hasAnyContent = hasCapability || hasContact || hasLinks || hasExamples;

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-0 border-b border-border/50 rounded-t-xl !p-4">
        <CardTitle className="text-base font-semibold leading-none">
          {t("capabilitiesAndDetails")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 px-6 py-5">
        {!hasAnyContent ? (
          <p className="text-sm text-muted-foreground">
            {t("noCapabilitiesAndDetails")}
          </p>
        ) : (
          <>
            {hasCapability ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SectionHeading>{t("sectionCapability")}</SectionHeading>
                </div>
                <div className="space-y-3 pl-6">
                  {fields.capabilityName ? (
                    <DetailRow label={tRegister("capabilityName")}>
                      {fields.capabilityName}
                    </DetailRow>
                  ) : null}
                  {fields.capabilityVersion ? (
                    <DetailRow label={tRegister("capabilityVersion")}>
                      {fields.capabilityVersion}
                    </DetailRow>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasCapability && (hasContact || hasLinks || hasExamples) ? (
              <Separator className="bg-border/60" />
            ) : null}

            {hasContact ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SectionHeading>{t("sectionContact")}</SectionHeading>
                </div>
                <div className="space-y-3 pl-6">
                  {fields.authorName ? (
                    <DetailRow label={t("authorName")}>
                      {fields.authorName}
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
                    <DetailRow label={t("organization")}>
                      {fields.organization}
                    </DetailRow>
                  ) : null}
                  {fields.contactOther ? (
                    <DetailRow label={t("contactOther")}>
                      <span className="whitespace-pre-wrap break-words">
                        {fields.contactOther}
                      </span>
                    </DetailRow>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasContact && (hasLinks || hasExamples) ? (
              <Separator className="bg-border/60" />
            ) : null}

            {hasLinks ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SectionHeading>{t("sectionLinks")}</SectionHeading>
                </div>
                <div className="space-y-3 pl-6">
                  {fields.termsOfUseUrl ? (
                    <DetailRow label={tRegister("termsOfUseUrl")}>
                      <ExternalUrl href={fields.termsOfUseUrl} />
                    </DetailRow>
                  ) : null}
                  {fields.privacyPolicyUrl ? (
                    <DetailRow label={tRegister("privacyPolicyUrl")}>
                      <ExternalUrl href={fields.privacyPolicyUrl} />
                    </DetailRow>
                  ) : null}
                  {fields.otherUrl ? (
                    <DetailRow label={tRegister("otherUrl")}>
                      <ExternalUrl href={fields.otherUrl} />
                    </DetailRow>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasLinks && hasExamples ? (
              <Separator className="bg-border/60" />
            ) : null}

            {hasExamples ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileOutput className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SectionHeading>{tRegister("exampleOutputs")}</SectionHeading>
                </div>
                <ul className="space-y-3 pl-6">
                  {fields.exampleOutputs.map((output, index) => {
                    const name =
                      output.name?.trim() || t("exampleOutputUntitled");
                    const url = output.url?.trim();
                    const mime = output.mimeType?.trim();
                    return (
                      <li
                        key={`${name}-${url ?? index}`}
                        className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                      >
                        <p className="text-sm font-medium">{name}</p>
                        {url ? <ExternalUrl href={url} label={url} /> : null}
                        {mime ? (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {mime}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
