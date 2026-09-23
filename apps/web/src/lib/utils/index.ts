export { cn } from "./cn";
export { getGreeting } from "./date";
export { formatName, getInitials } from "./format-name";
export {
  type AgentPricing,
  formatBalance,
  formatPricingDisplay,
  formatPricingDisplayCompact,
} from "./format-price";
export { formatX402Amount, groupDigits } from "./x402-format";

import sanitizeHtml from "sanitize-html";

export function shortenAddress(address: string, length = 6): string {
  if (!address) return "";
  if (address.length <= length * 2) return address;
  return address.slice(0, length) + "…" + address.slice(-length);
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeBasicHtmlEntities(text: string): string {
  return text.replace(
    /&(?:amp|lt|gt|quot|#39);/g,
    (entity) => HTML_ENTITY_MAP[entity] ?? entity,
  );
}

/** Strips HTML tags from a string to produce plain text for display. */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  const withoutTags = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return decodeBasicHtmlEntities(withoutTags).replace(/[<>]/g, "").trim();
}
