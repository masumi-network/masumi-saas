import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getAgentAction } from "@/lib/actions/agent.action";
import { type Agent } from "@/lib/api/agent.client";

import { AgentPageContent } from "./components/agent-page-content";

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
  const t = await getTranslations("App.Agents");
  const { id } = await params;

  const result = await getAgentAction(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const agent = result.data as unknown as Agent;

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          asChild
          className="-ml-2 rounded-full"
        >
          <Link href="/agents">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t("title")}</p>
          <h1 className="text-2xl font-light tracking-tight">{agent.name}</h1>
        </div>
      </div>

      <AgentPageContent agent={agent} />
    </div>
  );
}
