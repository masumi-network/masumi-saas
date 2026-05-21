"use client";

import { PanelLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import MasumiLogo from "@/components/masumi-logo";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

interface AdminHeaderProps {
  className?: string;
}

export default function AdminHeader({ className }: AdminHeaderProps) {
  const { toggleSidebar } = useSidebar();
  const t = useTranslations("Admin");

  return (
    <header
      className={`sticky top-0 z-20 h-14 shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-lg sm:h-16 ${className || ""}`}
    >
      <div className="mx-auto h-full w-full max-w-container">
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center gap-2 md:min-w-0">
            <div className="md:hidden flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 min-w-8"
              >
                <PanelLeftIcon className="h-4 w-4" />
              </Button>
              <Link href="/admin" className="flex items-center">
                <MasumiLogo />
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="hidden rounded-lg bg-primary/10 px-2.5 py-1 text-primary md:inline-block">
              {t("portalTitle")}
            </span>
          </div>

          <div className="flex flex-1" aria-hidden />
        </div>
      </div>
    </header>
  );
}
