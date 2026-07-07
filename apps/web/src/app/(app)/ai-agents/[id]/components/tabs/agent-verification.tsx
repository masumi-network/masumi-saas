"use client";

import { AgentVerificationCard } from "@/app/ai-agents/components/agent-verification-card";
import { type Agent } from "@/lib/api/agent.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";

interface AgentVerificationTabProps {
  agent: Agent;
  onVerificationSuccess: () => void | Promise<void>;
  resumePendingCredentialId?: string | null;
  onResumePendingCredentialConsumed?: () => void;
  onVerificationDialogClosed?: () => void;
}

export function AgentVerificationTab({
  agent,
  onVerificationSuccess,
  resumePendingCredentialId = null,
  onResumePendingCredentialConsumed,
  onVerificationDialogClosed,
}: AgentVerificationTabProps) {
  if (!isAgentVerificationFlowEnabled()) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-lg lg:min-w-96">
      <AgentVerificationCard
        agent={agent}
        onVerificationSuccess={onVerificationSuccess}
        resumePendingCredentialId={resumePendingCredentialId}
        onResumePendingCredentialConsumed={onResumePendingCredentialConsumed}
        onVerificationDialogClosed={onVerificationDialogClosed}
      />
    </div>
  );
}
