"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

type Phase = "idle" | "loading" | "error" | "ready";

type GeneratedPayload = {
  walletAddress: string;
  walletMnemonic: string;
};

export type GenerateWalletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  network: PaymentNodeNetwork;
  /** Fills the collection address field and closes this dialog. */
  onUseAddress: (address: string) => void;
};

export function GenerateWalletDialog({
  open,
  onOpenChange,
  network,
  onUseAddress,
}: GenerateWalletDialogProps) {
  const t = useTranslations("App.Agents.Register.GenerateWallet");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wallet, setWallet] = useState<GeneratedPayload | null>(null);

  const loadWallet = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    setWallet(null);
    try {
      const params = new URLSearchParams({ network });
      const res = await fetch(`/api/wallet/generate?${params}`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: GeneratedPayload;
      };
      if (!res.ok || json.success !== true || !json.data) {
        setPhase("error");
        setErrorMessage(json.error ?? t("error"));
        return;
      }
      setWallet({
        walletAddress: json.data.walletAddress,
        walletMnemonic: json.data.walletMnemonic,
      });
      setPhase("ready");
    } catch {
      setPhase("error");
      setErrorMessage(t("error"));
    }
  }, [network, t]);

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => loadWallet());
  }, [open, loadWallet]);

  /** Drop mnemonic / address from memory whenever the dialog is closed (any cause). */
  useEffect(() => {
    if (open) return;
    void Promise.resolve().then(() => {
      setPhase("idle");
      setWallet(null);
      setErrorMessage(null);
    });
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleUseAddress = () => {
    if (!wallet) return;
    onUseAddress(wallet.walletAddress);
    onOpenChange(false);
  };

  const handleDownloadTxt = useCallback(
    (w: GeneratedPayload) => {
      const content = [
        "Masumi — payout wallet backup",
        "",
        `Network: ${network}`,
        `${t("downloadGenerated")}: ${new Date().toISOString()}`,
        "",
        t("downloadDisclaimer"),
        "",
        `${t("mnemonicLabel")}:`,
        w.walletMnemonic,
        "",
        `${t("addressLabel")}:`,
        w.walletAddress,
        "",
      ].join("\n");

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `masumi-wallet-${network.toLowerCase()}-${Date.now()}.txt`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [network, t],
  );

  const showSensitive = phase === "ready" && wallet !== null;
  const showAwaiting =
    open && (phase === "idle" || phase === "loading") && !showSensitive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[60] sm:max-w-lg max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
        hideOverlay
        showCloseButton={!showSensitive}
        {...(showSensitive && {
          onInteractOutside: (e) => e.preventDefault(),
          onEscapeKeyDown: (e) => e.preventDefault(),
        })}
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          {showAwaiting && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Spinner size={32} />
              <p className="text-muted-foreground text-sm">{t("loading")}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4 py-4">
              <p className="text-destructive text-sm">{errorMessage}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void loadWallet()}
                >
                  {t("retry")}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t("close")}
                </Button>
              </div>
            </div>
          )}

          {showSensitive && wallet && (
            <div className="space-y-6">
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("mnemonicWarning")}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {t("mnemonicLabel")}
                  </span>
                  <CopyButton value={wallet.walletMnemonic} />
                </div>
                <Textarea
                  readOnly
                  value={wallet.walletMnemonic}
                  className="min-h-[100px] resize-none font-mono text-xs"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {t("addressLabel")}
                  </span>
                  <CopyButton value={wallet.walletAddress} />
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs">
                    {wallet.walletAddress}
                  </code>
                </div>
              </div>

              <p className="text-muted-foreground text-xs">
                {t("copyWarning")}
              </p>

              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => handleDownloadTxt(wallet)}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden />
                {t("downloadTxt")}
              </Button>
            </div>
          )}
        </div>

        {showSensitive && (
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("close")}
            </Button>
            <Button type="button" variant="primary" onClick={handleUseAddress}>
              {t("useAddress")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
