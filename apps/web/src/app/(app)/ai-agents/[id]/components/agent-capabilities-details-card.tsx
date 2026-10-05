"use client";

import { Cpu, FileOutput, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAgentDisplayMetadataFields } from "@/lib/agents/parse-agent-display-metadata";
import { type Agent } from "@/lib/api/agent.client";

import { DetailRow, ExternalUrl } from "./agent-details-metadata-ui";

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
  const hasLinks =
    Boolean(fields.termsOfUseUrl) ||
    Boolean(fields.privacyPolicyUrl) ||
    Boolean(fields.otherUrl);
  const hasExamples = fields.exampleOutputs.length > 0;
  const hasCapabilitiesContent = hasCapability || hasLinks || hasExamples;

  if (!hasCapabilitiesContent) {
    return null;
  }

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border/50 !p-4">
        <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
        <CardTitle className="text-base font-semibold leading-none">
          {t("capabilitiesCardTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 px-6 py-5">
        {hasCapability ? (
          <div className="space-y-3">
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
        ) : null}

        {hasCapability && hasLinks ? (
          <Separator className="bg-border/60" />
        ) : null}

        {hasLinks ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sectionLinks")}
              </p>
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

        {(hasCapability || hasLinks) && hasExamples ? (
          <Separator className="bg-border/60" />
        ) : null}

        {hasExamples ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileOutput className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tRegister("exampleOutputs")}
              </p>
            </div>
            <ul className="space-y-3 pl-6">
              {fields.exampleOutputs.map((output, index) => {
                const name = output.name?.trim() || t("exampleOutputUntitled");
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
      </CardContent>
    </Card>
  );
}
