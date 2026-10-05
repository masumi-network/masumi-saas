import { agentMetadataSchema, exampleOutputSchema } from "@/lib/schemas/agent";
import type { z } from "@/lib/zod-openapi";

export type AgentDisplayMetadata = z.infer<typeof agentMetadataSchema>;
type ExampleOutput = z.infer<typeof exampleOutputSchema>;

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseAgentDisplayMetadata(
  metadata: string | null | undefined,
): AgentDisplayMetadata | null {
  if (!metadata?.trim()) return null;
  try {
    const parsed = JSON.parse(metadata) as unknown;
    const result = agentMetadataSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function filledExampleOutputs(outputs: ExampleOutput[] | undefined) {
  if (!outputs?.length) return [];
  return outputs.filter(
    (entry) =>
      entry.name?.trim() || entry.url?.trim() || entry.mimeType?.trim(),
  );
}

export function getAgentDisplayMetadataFields(
  metadata: string | null | undefined,
) {
  const parsed = parseAgentDisplayMetadata(metadata);
  if (!parsed) {
    return {
      capabilityName: undefined,
      capabilityVersion: undefined,
      authorName: undefined,
      authorEmail: undefined,
      organization: undefined,
      contactOther: undefined,
      termsOfUseUrl: undefined,
      privacyPolicyUrl: undefined,
      otherUrl: undefined,
      exampleOutputs: [] as ExampleOutput[],
    };
  }

  return {
    capabilityName: trimOptional(parsed.capabilityName),
    capabilityVersion: trimOptional(parsed.capabilityVersion),
    authorName: trimOptional(parsed.authorName),
    authorEmail: trimOptional(parsed.authorEmail),
    organization: trimOptional(parsed.organization),
    contactOther: trimOptional(parsed.contactOther),
    termsOfUseUrl: trimOptional(parsed.termsOfUseUrl),
    privacyPolicyUrl: trimOptional(parsed.privacyPolicyUrl),
    otherUrl: trimOptional(parsed.otherUrl),
    exampleOutputs: filledExampleOutputs(parsed.exampleOutputs),
  };
}
