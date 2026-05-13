"use client";

import { AgentVerificationCard } from "@/app/ai-agents/components/agent-verification-card";
import { type Agent } from "@/lib/api/agent.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";

interface AgentCredentialsProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

export function AgentCredentials({
  agent,
  onVerificationSuccess,
}: AgentCredentialsProps) {
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
