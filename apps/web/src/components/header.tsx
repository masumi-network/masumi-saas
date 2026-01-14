"use client";

import { BookOpen, Menu, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import MasumiLogo from "@/components/masumi-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const t = useTranslations("Components.Header");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="max-w-container mx-auto w-full">
        <div className="h-14 px-4 flex items-center justify-between gap-4">
          <Link href="/">
            <MasumiLogo />
          </Link>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://docs.masumi.network"
                target="_blank"
                className="flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                {t("documentation")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://www.masumi.network/contact"
                target="_blank"
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                {t("support")}
              </Link>
            </Button>
          </div>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  href="https://docs.masumi.network"
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  {t("documentation")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="https://www.masumi.network/contact"
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("support")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
