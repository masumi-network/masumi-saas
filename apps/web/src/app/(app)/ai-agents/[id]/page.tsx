import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { syncAgentRegistrationStatusAction } from "@/lib/actions/agent.action";
import { getAgent } from "@/lib/api/agent.server";

import { AgentPageContent } from "./components/agent-page-content";

interface AgentPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AgentPageProps): Promise<Metadata> {
  const t = await getTranslations("App.Agents");
  const { id } = await params;
  const result = await getAgent(id);
  const agentName = result.success ? result.data.name : t("title");
  return {
    title: `Masumi - ${agentName}`,
  };
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params;

  // Reconcile with payment-node before render so stale RegistrationConfirmed
  // does not flash while the client mounts.
  await syncAgentRegistrationStatusAction(id);
  const result = await getAgent(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="w-full animate-page-in space-y-6">
      <AgentPageContent agent={result.data} />
    </div>
  );
}
