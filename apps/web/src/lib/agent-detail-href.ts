/**
 * Agent detail URL used from Activity and related surfaces.
 * Platform admins optionally land in the `(admin)` agent overview instead of the app agent page.
 */
export function agentDetailHref(
  agentId: string | null,
  linkAgentsInAdmin: boolean,
): string | null {
  if (!agentId) return null;
  return linkAgentsInAdmin
    ? `/admin/agents/${agentId}`
    : `/ai-agents/${agentId}`;
}
