"use client";

import { BookOpen, MessageSquare, PanelLeftIcon, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import MasumiLogo from "@/components/masumi-logo";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

import { NotificationsDialog } from "./notifications-dialog";
import { SearchDialog } from "./search-dialog";

interface HeaderProps {
  className?: string;
}

export default function Header({ className }: HeaderProps) {
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
        className={`sticky top-0 z-20 h-16 border-b border-border bg-background/95 backdrop-blur-md ${className || ""}`}
      >
        <div className="max-w-container mx-auto w-full h-full">
          <div className="h-full px-4 flex items-center justify-between gap-4">
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
              className="hidden md:flex w-full max-w-search min-w-0 justify-start gap-2 relative rounded-md border border-input bg-muted-surface px-3 py-2 text-sm ring-offset-background cursor-pointer items-center hover:bg-accent/50"
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
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden md:flex"
              >
                <Link
                  href="https://docs.masumi.network"
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  {t("documentation")}
                </Link>
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

      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
