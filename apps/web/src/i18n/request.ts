import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, Locale, locales } from "./config";

const messageLoaders: Record<Locale, () => Promise<{ default: IntlMessages }>> =
  {
    en: () => import("../../messages/en.json"),
    de: () => import("../../messages/de.json"),
    ja: () => import("../../messages/ja.json"),
    fr: () => import("../../messages/fr.json"),
    es: () => import("../../messages/es.json"),
  };

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await messageLoaders[locale]()).default,
  };
});
