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
    <div className="w-full lg:min-w-96 lg:max-w-md">
      <AgentVerificationCard
        agent={agent}
        onVerificationSuccess={onVerificationSuccess}
      />
    </div>
  );
}
