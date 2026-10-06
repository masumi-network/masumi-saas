"use client";

import { useTranslations } from "next-intl";

import { Separator } from "@/components/ui/separator";
import { getAgentDisplayMetadataFields } from "@/lib/agents/parse-agent-display-metadata";
import { type Agent } from "@/lib/api/agent.client";

import { AgentAuthorDetailsCard } from "./agent-author-details-card";
import { AgentCapabilitiesDetailsCard } from "./agent-capabilities-details-card";

export function AgentAdditionalDetailsSection({
  agent,
}: {
  agent: Pick<Agent, "metadata">;
}) {
  const t = useTranslations("App.Agents.Details");
  const fields = getAgentDisplayMetadataFields(agent.metadata);

  const hasAuthor =
    Boolean(fields.authorName) ||
    Boolean(fields.authorEmail) ||
    Boolean(fields.organization) ||
    Boolean(fields.contactOther);
  const hasCapabilities =
    Boolean(fields.capabilityName) ||
    Boolean(fields.capabilityVersion) ||
    Boolean(fields.termsOfUseUrl) ||
    Boolean(fields.privacyPolicyUrl) ||
    Boolean(fields.otherUrl) ||
    fields.exampleOutputs.length > 0;

  if (!hasAuthor && !hasCapabilities) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("additionalDetails")}
          </span>
          <Separator className="flex-1" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("noCapabilitiesAndDetails")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {t("additionalDetails")}
        </span>
        <Separator className="flex-1" />
      </div>
      <div className="flex flex-col gap-4">
        <AgentAuthorDetailsCard agent={agent} />
        <AgentCapabilitiesDetailsCard agent={agent} />
      </div>
    </div>
  );
}
