import { appConfig } from "@/lib/config/app.config";

export function getPublicMipAgentBaseUrl(agentId: string): string {
  const base = appConfig.appUrl.replace(/\/+$/, "");
  return `${base}/mip/agents/${encodeURIComponent(agentId)}`;
}
