export const INBOX_AGENT_LIMITS = {
  name: 120,
  slug: 80,
  description: 500,
} as const;

export const RESERVED_INBOX_AGENT_SLUGS = [
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
] as const;

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeInboxAgentSlug(value: string): string {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const normalizedReservedInboxAgentSlugs = new Set(
  RESERVED_INBOX_AGENT_SLUGS.map((slug) => normalizeInboxAgentSlug(slug)),
);

export function isReservedInboxAgentSlug(slug: string): boolean {
  return normalizedReservedInboxAgentSlugs.has(normalizeInboxAgentSlug(slug));
}
