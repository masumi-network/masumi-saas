/**
 * Email copy for transactional emails (reset password, verification, invitation).
 * Loaded from messages so auth callbacks don't depend on next-intl request context.
 * Supports locale-aware translations via getEmailMessages(locale).
 * Add messages/{locale}.json with an "Email" key to support more locales.
 */

import en from "../../../messages/en.json";

type EmailMessages = (typeof en)["Email"];

const SUPPORTED_LOCALES = ["en"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Add more locales by importing and adding to this map.
 * Each messages/{locale}.json must have an "Email" key with ResetPassword, Verification, Invitation.
 */
const messagesByLocale: Record<string, EmailMessages> = {
  en: (en as { Email: EmailMessages }).Email,
};

/** Parse Accept-Language header to preferred locale. Returns "en" if unsupported or missing. */
export function parseAcceptLanguage(header: string | null): string {
  if (!header) return "en";
  const parts = header.split(",").map((p) => {
    const [lang, q = "1"] = p.trim().split(";q=");
    return { lang: lang.split("-")[0].toLowerCase(), q: parseFloat(q) || 1 };
  });
  parts.sort((a, b) => b.q - a.q);
  const supported = new Set(SUPPORTED_LOCALES);
  for (const { lang } of parts) {
    if (supported.has(lang as SupportedLocale)) return lang;
  }
  return "en";
}

/**
 * Get email messages for the given locale. Falls back to "en" if locale is unsupported.
 * Use with parseAcceptLanguage(request.headers.get("accept-language")) when request is available.
 */
export function getEmailMessages(locale?: string): EmailMessages {
  const resolved =
    locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale)
      ? locale
      : "en";
  return messagesByLocale[resolved] ?? messagesByLocale.en;
}

/** @deprecated Use getEmailMessages(locale) for locale-aware emails. */
export const emailMessagesEn: EmailMessages = messagesByLocale.en;
