"use client";

import { useTranslations } from "next-intl";

import type { GetAdminAgentsResult } from "@/lib/api/admin.types";

import AgentsList from "./agents-list";

interface AdminAgentsContentProps {
  result: GetAdminAgentsResult;
}

export default function AdminAgentsContent({
  result,
}: AdminAgentsContentProps) {
  const t = useTranslations("Admin.Agents");

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive p-6">
        <p className="text-destructive text-center">
          {t("errorLoadingAgents")}
        </p>
      </div>
    );
  }

  return (
    <AgentsList
      agents={result.data.agents}
      pagination={result.data.pagination}
      currentSearch={result.data.search}
    />
  );
}
