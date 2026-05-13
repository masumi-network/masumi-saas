export const locales = ["en", "de", "ja", "fr", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
