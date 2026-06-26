"use client";

import { ArrowRight, Coins, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useX402SetupDialog } from "@/components/x402/x402-setup-dialog";
import { useX402Rail } from "@/lib/context/x402-rail-context";
import { useX402Networks } from "@/lib/hooks/use-x402";
import { cn } from "@/lib/utils";
import { isX402SetUpForIsTestnet, X402_ACCENT } from "@/lib/x402-rail";

const DISMISSED_KEY_PREFIX = "masumi_x402_banner_dismissed_";

function getServerSnapshot() {
  return true;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function X402SetupBanner() {
  const t = useTranslations("App.X402.SetupBanner");
  const tChains = useTranslations("App.X402.Chains");
  const { openSetup } = useX402SetupDialog();
  const { x402IsTestnet } = useX402Rail();
  const environment = x402IsTestnet ? tChains("testnet") : tChains("mainnet");
  const dismissKey = `${DISMISSED_KEY_PREFIX}${x402IsTestnet ? "testnet" : "mainnet"}`;
  const { networks, isLoading } = useX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });

  const getSnapshot = useCallback(
    () =>
      typeof window === "undefined"
        ? false
        : localStorage.getItem(dismissKey) === "true",
    [dismissKey],
  );
  const isDismissedFromStorage = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);

  if (isLoading) return null;
  if (isX402SetUpForIsTestnet(networks, x402IsTestnet)) return null;
  if (isDismissedFromStorage || dismissed) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(dismissKey, "true");
      } catch {
        // Safari private mode / quota exceeded
      }
    }
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border-2 shadow-md",
        "border-indigo-300/60 bg-gradient-to-br from-indigo-50 via-indigo-50/60 to-background",
        "dark:border-indigo-900/50 dark:from-indigo-950/30 dark:via-indigo-950/15 dark:to-background",
      )}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 z-10 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("dismiss")}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/30">
            <Coins className={cn("h-6 w-6", X402_ACCENT.icon)} />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {t("title", { environment })}
              </h2>
              <Badge variant="outline" className="font-medium">
                {t("evmBadge")}
              </Badge>
              <Badge variant="secondary" className="font-medium">
                {environment}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="shrink-0 gap-2"
          onClick={() => openSetup()}
        >
          <Coins className="h-4 w-4" />
          {t("cta")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
