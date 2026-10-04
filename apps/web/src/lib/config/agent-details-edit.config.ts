/**
 * Registry metadata edits submit an on-chain update via the payment node.
 * Enabled by default; set NEXT_PUBLIC_DISABLE_AGENT_DETAILS_EDIT=true to hide edit UI.
 */
export function isAgentDetailsEditEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DISABLE_AGENT_DETAILS_EDIT?.trim().toLowerCase() !==
    "true"
  );
}
