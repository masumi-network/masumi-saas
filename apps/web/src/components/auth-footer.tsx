"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export function AuthFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-16 flex justify-center items-center bg-background/80 backdrop-blur-md border-t">
      <div className="max-w-[1400px] mx-auto w-full h-full px-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Link
            href="https://www.masumi.network/about"
            target="_blank"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            About
          </Link>
          <Link
            href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
            target="_blank"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <Link
            href="https://www.masumi.network/legal"
            target="_blank"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Legal
          </Link>
        </div>
        <div>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
