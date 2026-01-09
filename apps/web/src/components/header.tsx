import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, MessageSquare } from "lucide-react";
import MasumiLogo from "@/components/masumi-logo";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto w-full">
        <div className="h-14 px-4 flex items-center justify-between gap-4">
          <Link href="/">
            <MasumiLogo />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://docs.masumi.network"
                target="_blank"
                className="flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Documentation
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://www.masumi.network/contact"
                target="_blank"
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Support
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
