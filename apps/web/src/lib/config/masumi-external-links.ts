/**
 * Canonical Masumi marketing-site destinations for Imprint, Support, and Discord.
 * Imprint and Legal are separate — do not point "Legal" at /imprint.
 * Override with NEXT_PUBLIC_* env vars when needed.
 */
export const DEFAULT_IMPRINT_PAGE_URL = "https://www.masumi.network/imprint";

export const DEFAULT_SUPPORT_PAGE_URL = "https://www.masumi.network/contact";

export const DEFAULT_DISCORD_INVITE_URL =
  "https://discord.com/invite/aj4QfnTS92";

/** @deprecated Dead URL — masumi.network/legal returns 404. */
export const LEGACY_LEGAL_PAGE_URL = "https://www.masumi.network/legal";

/** @deprecated Legacy support URL — active Support links must use SUPPORT_PAGE_URL. */
export const LEGACY_SUPPORT_PAGE_URL = "https://masumi.network/support";

export const IMPRINT_PAGE_URL =
  process.env.NEXT_PUBLIC_IMPRINT_PAGE_URL?.trim() || DEFAULT_IMPRINT_PAGE_URL;

export const SUPPORT_PAGE_URL =
  process.env.NEXT_PUBLIC_SUPPORT_PAGE_URL?.trim() || DEFAULT_SUPPORT_PAGE_URL;

export const DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() ||
  DEFAULT_DISCORD_INVITE_URL;

/** External Masumi links open in a new tab with safe referrer policy. */
export const MASUMI_EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
