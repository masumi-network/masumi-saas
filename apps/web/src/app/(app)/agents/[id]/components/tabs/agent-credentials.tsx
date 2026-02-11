"use client";

import { type Agent } from "@/lib/api/agent.client";

import { AgentVerificationCard } from "../../../components/agent-verification-card";

interface AgentCredentialsProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

export function AgentCredentials({
  agent,
  onVerificationSuccess,
}: AgentCredentialsProps) {
  return (
    <div className="w-full max-w-lg lg:min-w-96">
      <AgentVerificationCard
        agent={agent}
        onVerificationSuccess={onVerificationSuccess}
      />
    </div>
  );
}
