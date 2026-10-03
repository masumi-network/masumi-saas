import { appConfig } from "@/lib/config/app.config";

export function getPublicX402ManifestUrl(agentId: string): string {
  const base = appConfig.appUrl.replace(/\/+$/, "");
  return `${base}/api/public/x402-manifest/${encodeURIComponent(agentId)}`;
}
