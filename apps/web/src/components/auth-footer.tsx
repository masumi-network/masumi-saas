import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/i18n/config";

export async function AuthFooter() {
  const t = await getTranslations("Footer");
  const locale = (await getLocale()) as Locale;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-center border-t bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-container items-center justify-between gap-2 px-4 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher currentLocale={locale} />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          <Link
            href="https://www.masumi.network/about"
            target="_blank"
            className="hidden text-xs text-muted-foreground tracking-tight hover:text-foreground sm:inline sm:text-sm"
          >
            {t("about")}
          </Link>
          <Link
            href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
            target="_blank"
            className="shrink-0 text-[11px] text-muted-foreground tracking-tight hover:text-foreground sm:text-sm"
          >
            {t("privacyPolicy")}
          </Link>
          <Link
            href="https://www.masumi.network/legal"
            target="_blank"
            className="shrink-0 text-[11px] text-muted-foreground tracking-tight hover:text-foreground sm:text-sm"
          >
            {t("legal")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
