"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { isLegacyV1RegistryAgent } from "@/lib/registry/version-independent-agent-id";
import { cn } from "@/lib/utils";

export function AgentRegistryVersionBadge({
  agentIdentifier,
  className,
}: {
  agentIdentifier: string | null | undefined;
  className?: string;
}) {
  const t = useTranslations("App.Agents");

  if (!isLegacyV1RegistryAgent(agentIdentifier)) {
    return null;
  }

  return (
    <Badge
      variant="warning"
      className={cn("shrink-0 px-1.5 py-0 text-[10px] leading-5", className)}
      aria-label={t("registryVersionV1Aria")}
    >
      {t("registryVersionV1")}
    </Badge>
  );
}
