"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "./header";
import { Footer } from "./footer";

export function MobileBlocker({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!mounted) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center bg-background text-foreground pt-14 pb-20">
          <div className="text-center space-y-4 p-4">
            <div className="text-lg text-muted-foreground">
              Please use a desktop device to <br /> access the Masumi Platform
            </div>
            <Button variant="outline" asChild>
              <Link href="https://docs.masumi.io" target="_blank">
                Learn more
              </Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return <>{children}</>;
}
