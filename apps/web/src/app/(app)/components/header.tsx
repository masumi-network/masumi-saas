"use client";

import { BookOpen, Menu, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { toggleSidebar } = useSidebar();

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
            <Link href="/" className="md:hidden">
              <MasumiLogo />
            </Link>

            <div
              className="hidden md:flex w-full max-w-search justify-start gap-2 relative rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer items-center hover:bg-accent/30"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Type</span>
                <kbd className="bg-muted text-foreground pointer-events-none inline-flex h-6 items-center justify-center rounded-md border px-2 font-mono text-xs">
                  /
                </kbd>
                <span>to search</span>
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
                  Documentation
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
                  Support
                </Link>
              </Button>
              <div className="hidden md:flex">
                <NotificationsDialog
                  open={isNotificationsOpen}
                  onOpenChange={setIsNotificationsOpen}
                />
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
                <NotificationsDialog
                  open={isNotificationsOpen}
                  onOpenChange={setIsNotificationsOpen}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 min-w-8 md:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
