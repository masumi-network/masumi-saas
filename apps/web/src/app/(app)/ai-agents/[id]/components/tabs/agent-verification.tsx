"use client";

import { AgentVerificationCard } from "@/app/ai-agents/components/agent-verification-card";
import { type Agent } from "@/lib/api/agent.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";

interface AgentVerificationTabProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

export function AgentVerificationTab({
  agent,
  onVerificationSuccess,
}: AgentVerificationTabProps) {
  if (!isAgentVerificationFlowEnabled()) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-lg lg:min-w-96">
      <AgentVerificationCard
        agent={agent}
        onVerificationSuccess={onVerificationSuccess}
      />
    </div>
  );
}
