import {
  INBOX_AGENT_LIMITS,
  isReservedInboxAgentSlug,
  normalizeInboxAgentSlug,
} from "@/lib/inbox-agents/validation";
import { parseNetwork } from "@/lib/schemas/api-query";
import { z } from "@/lib/zod-openapi";

export const inboxAgentStateSchema = z.enum([
  "RegistrationRequested",
  "RegistrationInitiated",
  "RegistrationConfirmed",
  "RegistrationFailed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
]);

export const inboxAgentFilterStatusSchema = z.enum([
  "Registered",
  "Deregistered",
  "Pending",
  "Failed",
]);

export const inboxAgentsListQuerySchema = z.object({
  cursor: z.string().optional().openapi({
    description:
      "Cursor from the previous response (`nextCursor`). A cursor is valid only when reusing the same `network`, `filterStatus`, and `search` values; changing any of them invalidates pagination and may return HTTP 410.",
  }),
  take: z.coerce.number().int().min(1).max(50).optional().default(10),
  search: z.string().trim().optional(),
  filterStatus: inboxAgentFilterStatusSchema.optional(),
  network: z
    .string()
    .optional()
    .nullable()
    .transform((value) => parseNetwork(value)),
});

export const inboxAgentIdRouteParamSchema = z
  .string()
  .min(1, "Inbox agent ID is required")
  .max(64, "Inbox agent ID is invalid");

export const registerInboxAgentBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(
        INBOX_AGENT_LIMITS.name,
        `Name must be less than ${INBOX_AGENT_LIMITS.name} characters`,
      ),
    description: z
      .string()
      .trim()
      .max(
        INBOX_AGENT_LIMITS.description,
        `Description must be less than ${INBOX_AGENT_LIMITS.description} characters`,
      )
      .optional()
      .or(z.literal("")),
    agentSlug: z
      .string()
      .min(1, "Inbox slug is required")
      .max(
        INBOX_AGENT_LIMITS.slug * 2,
        `Inbox slug is too long to normalize safely`,
      ),
  })
  .strict();

export type RegisterInboxAgentBody = z.infer<
  typeof registerInboxAgentBodySchema
>;

export function getCanonicalInboxAgentSlug(input: string): string {
  return normalizeInboxAgentSlug(input);
}

export function validateCanonicalInboxAgentSlug(slug: string): string | null {
  if (!slug) return "Inbox slug is required";
  if (slug.length > INBOX_AGENT_LIMITS.slug) {
    return `Inbox slug must be less than ${INBOX_AGENT_LIMITS.slug} characters`;
  }
  if (isReservedInboxAgentSlug(slug)) {
    return "Inbox slug is reserved";
  }
  return null;
}
