import type { X402AgentManifest } from "@masumi/payment-source-x402";

import { agentMetadataSchema } from "@/lib/schemas/agent";
import { z } from "@/lib/zod-openapi";

const x402ManifestSchema = z.object({
  x402Version: z.number(),
  resources: z.array(
    z.object({
      resource: z.string().url(),
      type: z.enum(["http", "mcp"]),
      description: z.string().optional(),
    }),
  ),
});

export const agentX402RegistryMetadataSchema = agentMetadataSchema.extend({
  registryEntryType: z.literal("X402").optional(),
  x402Manifest: x402ManifestSchema.optional(),
});

export type AgentX402RegistryMetadata = z.infer<
  typeof agentX402RegistryMetadataSchema
>;

export function parseAgentRegistryMetadata(
  raw: string | null | undefined,
): AgentX402RegistryMetadata | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = agentX402RegistryMetadataSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isX402RegistryAgent(
  metadata: AgentX402RegistryMetadata | null,
): metadata is AgentX402RegistryMetadata & {
  registryEntryType: "X402";
  x402Manifest: X402AgentManifest;
} {
  return (
    metadata?.registryEntryType === "X402" &&
    metadata.x402Manifest != null &&
    metadata.x402Manifest.resources.length > 0
  );
}
