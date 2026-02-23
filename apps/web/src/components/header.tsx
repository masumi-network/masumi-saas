"use client";

import { BookOpen, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import MasumiLogo from "@/components/masumi-logo";
import { Button } from "@/components/ui/button";

export function Header() {
  const t = useTranslations("Components.Header");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="max-w-container mx-auto w-full">
        <div className="h-16 px-4 flex items-center justify-between gap-4">
          <Link href="/">
            <MasumiLogo />
          </Link>
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
            <Button variant="outline" size="icon" asChild className="md:hidden">
              <Link
                href="https://docs.masumi.network"
                target="_blank"
                aria-label={t("documentation")}
              >
                <BookOpen className="h-4 w-4" />
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
            <Button variant="outline" size="icon" asChild className="md:hidden">
              <Link
                href="https://www.masumi.network/contact"
                target="_blank"
                aria-label={t("support")}
              >
                <MessageSquare className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
