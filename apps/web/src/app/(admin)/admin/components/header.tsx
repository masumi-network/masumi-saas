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
      className={`sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-md ${className || ""}`}
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
            <Link href="/admin" className="flex items-center">
              <MasumiLogo />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="px-2 py-1 rounded-md bg-primary/10 text-primary">
                {t("portalTitle")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
