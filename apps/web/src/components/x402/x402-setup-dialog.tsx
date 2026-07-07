"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X402Logo } from "@/components/x402/x402-logo";
import { useX402Rail } from "@/lib/context/x402-rail-context";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

import { X402SetupWelcome } from "./setup/x402-setup-welcome";

const SETUP_QUERY = "setup";

type X402SetupDialogContextValue = {
  open: boolean;
  openSetup: () => void;
  closeSetup: () => void;
};

const X402SetupDialogContext =
  createContext<X402SetupDialogContextValue | null>(null);

function buildX402Path(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `/x402?${query}` : "/x402";
}

export function X402SetupDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setIsSetupMode } = useX402Rail();
  const [openExplicit, setOpenExplicit] = useState(false);

  const setupFromUrl = searchParams.get(SETUP_QUERY) === "1";
  const isOpen = openExplicit || setupFromUrl;

  const clearSetupQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(SETUP_QUERY);
    params.delete("network");
    router.replace(buildX402Path(params), { scroll: false });
  }, [router, searchParams]);

  const closeSetup = useCallback(() => {
    setOpenExplicit(false);
    setIsSetupMode(false);
    clearSetupQuery();
  }, [clearSetupQuery, setIsSetupMode]);

  const openSetup = useCallback(() => {
    setOpenExplicit(true);
    setIsSetupMode(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set(SETUP_QUERY, "1");
    params.delete("network");
    router.replace(buildX402Path(params), { scroll: false });
  }, [router, searchParams, setIsSetupMode]);

  useEffect(() => {
    setIsSetupMode(isOpen);
  }, [isOpen, setIsSetupMode]);

  const value = useMemo(
    () => ({ open: isOpen, openSetup, closeSetup }),
    [isOpen, openSetup, closeSetup],
  );

  return (
    <X402SetupDialogContext.Provider value={value}>
      {children}
      <X402SetupDialog open={isOpen} onClose={closeSetup} />
    </X402SetupDialogContext.Provider>
  );
}

export function useX402SetupDialog(): X402SetupDialogContextValue {
  const ctx = useContext(X402SetupDialogContext);
  if (!ctx) {
    throw new Error(
      "useX402SetupDialog must be used within X402SetupDialogProvider",
    );
  }
  return ctx;
}

function X402SetupDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("App.X402.Setup");

  return (
    <Dialog open={open}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div
          className={cn(
            "shrink-0 border-b bg-masumi-gradient px-6 py-5",
            dialogHeaderEnterClass,
          )}
        >
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-3">
              <X402Logo className="h-10 shrink-0" />
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {t("dialogTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("pageDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <X402SetupWelcome embedded onFinish={onClose} />
      </DialogContent>
    </Dialog>
  );
}
