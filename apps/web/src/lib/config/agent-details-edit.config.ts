/**
 * Registry metadata edits submit an on-chain update via the payment node.
 * Off by default until holder-wallet update issues are resolved; set
 * NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT=true to show the edit UI and accept
 * PATCH /api/agents/{agentId}.
 */
export function isAgentDetailsEditEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT?.trim().toLowerCase() ===
    "true"
  );
}
