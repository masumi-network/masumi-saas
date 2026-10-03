/**
 * Registry metadata edits submit an on-chain update via the payment node.
 * Enable when the payment-service holder wallet reliably funds update txs.
 */
export function isAgentDetailsEditEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT?.trim().toLowerCase() ===
    "true"
  );
}
