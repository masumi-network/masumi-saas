"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const COOKIE_NAME = "cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

interface CookieConsentProps {
  onDismiss?: (() => void) | undefined;
}

export default function CookieConsent({ onDismiss }: CookieConsentProps) {
  const t = useTranslations("Components.CookieConsent");
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const visible = isClient && !getCookie(COOKIE_NAME);
  const [hideBanner, setHideBanner] = useState(false);

  const handleGotIt = () => {
    setCookie(COOKIE_NAME, "dismissed", COOKIE_MAX_AGE);
    setHideBanner(true);
    onDismiss?.();
  };

  const showBanner = visible && !hideBanner;

  if (!showBanner) return null;

  return (
    <div
      className={cn(
        "fixed right-0 bottom-0 left-0 z-[9999] p-2 transition-all duration-700 sm:max-w-md sm:left-auto sm:p-4",
        showBanner ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
      )}
    >
      <div className="bg-background rounded-lg border p-4 shadow-lg flex items-center gap-4">
        <p className="text-muted-foreground text-xs leading-relaxed flex-1">
          {t("description")}{" "}
          <Link
            href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
            target="_blank"
            className="underline hover:text-foreground"
          >
            {t("learnMore")}
          </Link>
        </p>
        <Button onClick={handleGotIt} size="sm">
          {t("gotIt")}
        </Button>
      </div>
    </div>
  );
}
