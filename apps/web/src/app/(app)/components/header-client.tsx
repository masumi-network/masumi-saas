"use client";

import { BookOpen, MessageSquare, PanelLeftIcon, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import MasumiLogo from "@/components/masumi-logo";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

import { CreditBalanceLink } from "./credit-balance-link";
import { NotificationsDialog } from "./notifications-dialog";
import { SearchDialog } from "./search-dialog";

interface HeaderClientProps {
  className?: string;
  stripeTopUpEnabled: boolean;
}

export function HeaderClient({
  className,
  stripeTopUpEnabled,
}: HeaderClientProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { toggleSidebar } = useSidebar();
  const t = useTranslations("App.Header");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-20 h-14 shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-lg sm:h-16 ${className || ""}`}
      >
        <div className="mx-auto h-full w-full max-w-container">
          <div className="flex h-full items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
            <div className="md:hidden flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 min-w-8"
              >
                <PanelLeftIcon className="h-4 w-4" />
              </Button>
              <Link href="/" className="flex items-center">
                <MasumiLogo />
              </Link>
            </div>

            <div
              className="relative hidden w-full min-w-0 max-w-search cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-muted-surface/80 px-3 py-2.5 text-sm ring-offset-background transition-colors hover:border-primary/25 hover:bg-accent/40 md:flex"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 shrink items-center gap-2 overflow-hidden whitespace-nowrap text-muted-foreground">
                <span>{t("type")}</span>
                <kbd className="bg-muted text-foreground pointer-events-none inline-flex h-6 shrink-0 items-center justify-center rounded-md border px-2 font-mono text-xs">
                  /
                </kbd>
                <span>{t("toSearch")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CreditBalanceLink
                className="shrink-0"
                balanceLinkToTopUp={stripeTopUpEnabled}
              />

              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden md:flex"
              >
                <a
                  href="https://docs.masumi.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  {t("documentation")}
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden md:flex"
              >
                <Link
                  href="https://www.masumi.network/contact"
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("support")}
                </Link>
              </Button>
              <div className="hidden md:flex">
                <NotificationsDialog />
              </div>

              <Button
                variant="outline"
                size="icon"
                asChild
                className="w-8 h-8 md:hidden"
              >
                <a
                  href="https://docs.masumi.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("documentation")}
                >
                  <BookOpen className="h-4 w-4" />
                </a>
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
                className="h-8 w-8 md:hidden"
              >
                <Search className="h-4 w-4" />
              </Button>
              <div className="md:hidden">
                <NotificationsDialog />
              </div>
            </div>
          </div>
        </div>
      </header>

      <SearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        stripeTopUpEnabled={stripeTopUpEnabled}
      />
    </>
  );
}
