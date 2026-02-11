import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAgentAction } from "@/lib/actions/agent.action";
import { type Agent } from "@/lib/api/agent.client";

import { AgentPageContent } from "./components/agent-page-content";
import { AgentPageHeader } from "./components/agent-page-header";

interface AgentPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AgentPageProps): Promise<Metadata> {
  const t = await getTranslations("App.Agents");
  const { id } = await params;
  const result = await getAgentAction(id);
  const agentName = result.success ? result.data.name : t("title");
  return {
    title: `Masumi - ${agentName}`,
  };
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params;

  const result = await getAgentAction(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const agent = result.data as unknown as Agent;

  return (
    <div className="w-full space-y-4">
      <AgentPageContent
        agent={agent}
        header={<AgentPageHeader agent={agent} />}
      />
    </div>
  );
}
