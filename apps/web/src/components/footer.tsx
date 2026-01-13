"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

export function Footer() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Components.Footer");

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 p-4 flex justify-center items-center bg-background/80 backdrop-blur-md border-t">
      <div className="max-w-container mx-auto w-full flex justify-between items-center">
        <div className="flex gap-4">
          <a
            href="https://www.masumi.network/about"
            target="_blank"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("about")}
          </a>
          <a
            href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
            target="_blank"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("privacyPolicy")}
          </a>
        </div>
        <div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-sm text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted"
            title={
              mounted && theme
                ? t("switchToTheme", { theme: theme === "dark" ? t("light") : t("dark") })
                : t("toggleTheme")
            }
          >
            {!mounted ? (
              <Sun className="h-5 w-5" />
            ) : theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}
