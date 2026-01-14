"use client";

import { Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Session } from "@/lib/auth/auth";

import UserProfile from "./user-profile";

interface HeaderProps {
  session: Session;
  className?: string;
}

export default function Header({ session, className }: HeaderProps) {
  const [_isSearchOpen, setIsSearchOpen] = useState(false);
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
    <header
      className={`sticky top-0 z-20 h-16 border-b border-border bg-background/95 backdrop-blur-md ${className || ""}`}
    >
      <div className="max-w-container mx-auto w-full h-full">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="flex w-full max-w-search justify-start gap-2 relative rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer items-center hover:bg-accent/30"
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

          <div className="flex">
            <UserProfile session={session} />
          </div>
        </div>
      </div>
    </header>
  );
}
