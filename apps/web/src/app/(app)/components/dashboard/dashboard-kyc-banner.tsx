"use client";

import { ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "dismissedDashboardKycPrompt";

interface DashboardKycBannerProps {
  startKycPrompt: string;
  startKyc: string;
}

export function DashboardKycBanner({
  startKycPrompt,
  startKyc,
}: DashboardKycBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed =
      typeof window !== "undefined" &&
      localStorage.getItem(STORAGE_KEY) === "1";
    const id = requestAnimationFrame(() => setIsDismissed(dismissed));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setIsDismissed(true);
  }, []);

  if (isDismissed) return null;

  return (
    <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <p className="text-sm text-muted-foreground">{startKycPrompt}</p>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild variant="outline" size="sm">
          <Link href="/verification" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {startKyc}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
