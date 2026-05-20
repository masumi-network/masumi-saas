import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/i18n/config";

export async function AuthFooter() {
  const t = await getTranslations("Footer");
  const locale = (await getLocale()) as Locale;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-16 flex justify-center items-center bg-background/80 backdrop-blur-md border-t">
      <div className="max-w-container mx-auto w-full h-full px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher currentLocale={locale} />
        </div>
        <div className="flex flex-wrap items-center flex-1 justify-end gap-4">
          <Link
            href="https://www.masumi.network/about"
            target="_blank"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
          >
            {t("about")}
          </Link>
          <Link
            href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
            target="_blank"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
          >
            {t("privacyPolicy")}
          </Link>
          <Link
            href="https://www.masumi.network/legal"
            target="_blank"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
          >
            {t("legal")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
