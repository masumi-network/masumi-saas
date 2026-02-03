/* eslint-disable @typescript-eslint/no-explicit-any -- DAppPeerConnect types require any */
"use client";

import type { DAppPeerConnect } from "@fabianbormann/cardano-peer-connect";
import { QrCode, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";

interface VeridianWalletConnectProps {
  onConnect: (aid: string) => void;
  onError?: (error: string) => void;
  appName?: string;
  className?: string;
}

/**
 * Veridian Wallet Connection Component
 * Handles CIP-45 peer-to-peer connection with Veridian wallet via QR code
 */
export function VeridianWalletConnect({
  onConnect,
  onError,
  appName = "Masumi",
  className,
}: VeridianWalletConnectProps) {
  const t = useTranslations("App.Components.VeridianWallet");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [aid, setAid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_walletName, setWalletName] = useState<string | null>(null);
  const [meerkatId, setMeerkatId] = useState<string | null>(null);
  const [qrCodeReady, setQrCodeReady] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrDivRef = useRef<HTMLDivElement | null>(null);
  const dAppConnectRef = useRef<DAppPeerConnect | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupQRCode = () => {
    if (dAppConnectRef.current) {
      try {
        (dAppConnectRef.current as { close?: () => void }).close?.();
      } catch (err) {
        console.debug("DAppPeerConnect close error:", err);
      }
      dAppConnectRef.current = null;
    }

    if (qrContainerRef.current) {
      while (qrContainerRef.current.firstChild) {
        qrContainerRef.current.removeChild(qrContainerRef.current.firstChild);
      }
      qrContainerRef.current.innerHTML = "";
    }
    qrDivRef.current = null;
    setQrCodeReady(false);
  };

  const initializeCIP45 = async () => {
    if (typeof window === "undefined") return;

    try {
      cleanupQRCode();

      setIsConnecting(true);
      setError(null);

      const { DAppPeerConnect } =
        await import("@fabianbormann/cardano-peer-connect");

      const dAppConnectInstance = new DAppPeerConnect({
        dAppInfo: {
          name: appName,
          url: window.location.origin,
        },
        verifyConnection: (
          walletInfo: any,
          callback: (
            granted: boolean,
            allowAutoConnect: boolean,
            walletInfo?: any,
          ) => void,
        ) => {
          console.log("Wallet connection request:", walletInfo);
          callback(true, true, walletInfo);
        },
        onApiInject: async (injectedWalletName: string) => {
          console.log("CIP-45 API injected:", injectedWalletName);
          setWalletName(injectedWalletName);
        },
        onConnect: async (address: string, walletInfo: unknown) => {
          console.log("CIP-45 connected", address, walletInfo);
          setIsConnecting(false);
          setIsConnected(true);

          const walletInfoObj = walletInfo as { name?: string } | null;
          const connectedWalletName = walletInfoObj?.name || "idw_p2p";
          setWalletName(connectedWalletName);

          const start = Date.now();
          const interval = 100;
          const timeout = 10000;

          const checkApi = setInterval(async () => {
            const api = (window as { cardano?: Record<string, unknown> })
              .cardano?.[connectedWalletName];

            if (api || Date.now() - start > timeout) {
              clearInterval(checkApi);

              if (
                api &&
                typeof api === "object" &&
                "enable" in api &&
                typeof api.enable === "function"
              ) {
                try {
                  const enabledApi = await (
                    api.enable as () => Promise<{
                      experimental?: {
                        getKeriIdentifier?: () => Promise<{ id?: string }>;
                      };
                    }>
                  )();
                  if (enabledApi?.experimental?.getKeriIdentifier) {
                    const keriIdentifier =
                      await enabledApi.experimental.getKeriIdentifier();
                    if (keriIdentifier?.id) {
                      setAid(keriIdentifier.id);
                      onConnect(keriIdentifier.id);
                      if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = null;
                      }
                      return;
                    }
                  }
                } catch (err) {
                  console.error("Failed to get KERI identifier:", err);
                }
              }

              const walletInfoObj = walletInfo as {
                identifier?: string;
                aid?: string;
              } | null;
              const identifier =
                walletInfoObj?.identifier || walletInfoObj?.aid;
              if (identifier) {
                setAid(identifier);
                onConnect(identifier);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
              } else {
                const errorMsg =
                  "Failed to get KERI identifier. API not available.";
                setError(errorMsg);
                onError?.(errorMsg);
                setIsConnecting(false);
              }
            }
          }, interval);
        },
        onDisconnect: () => {
          console.log("CIP-45 disconnected");
          setIsConnected(false);
          setIsConnecting(false);
          setAid(null);
          setWalletName(null);
          setMeerkatId(null);
          cleanupQRCode();
        },
      });

      dAppConnectRef.current = dAppConnectInstance;

      try {
        const meerkatIdValue = (
          dAppConnectInstance as unknown as {
            meerkat?: { identifier?: string };
          }
        ).meerkat?.identifier;
        if (meerkatIdValue) {
          setMeerkatId(meerkatIdValue);
          console.log("Meerkat ID:", meerkatIdValue);
        }
      } catch (err) {
        console.error("Failed to get meerkat ID:", err);
      }

      try {
        if (qrContainerRef.current) {
          const qrDiv = document.createElement("div");
          qrDiv.style.width = "256px";
          qrDiv.style.height = "256px";
          qrDiv.style.display = "flex";
          qrDiv.style.alignItems = "center";
          qrDiv.style.justifyContent = "center";

          await dAppConnectInstance.generateQRCode(qrDiv);

          qrContainerRef.current.appendChild(qrDiv);
          qrDivRef.current = qrDiv;
          setQrCodeReady(true);
        }
      } catch (qrError) {
        console.error("QR code generation error:", qrError);
        const errorMsg = t("failedToGenerateQR");
        setError(errorMsg);
        onError?.(errorMsg);
      }

      timeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          console.log("Connection timeout");
          setIsConnecting(false);
          const errorMsg = t("connectionTimeout");
          setError(errorMsg);
          onError?.(errorMsg);
        }
      }, 30000);
    } catch (err) {
      console.error("Failed to initialize CIP-45:", err);
      const errorMsg =
        err instanceof Error ? err.message : t("failedToInitialize");
      setError(errorMsg);
      onError?.(errorMsg);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAid(null);
    setWalletName(null);
    setMeerkatId(null);
    cleanupQRCode();
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      cleanupQRCode();
    };
  }, []);

  if (isConnected && aid) {
    return (
      <div className={className}>
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("connected")}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {aid}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="w-full"
          >
            {t("disconnect")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {!isConnecting && !error && (
          <Button
            onClick={initializeCIP45}
            className="w-full"
            variant="default"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {t("connectButton")}
          </Button>
        )}

        {isConnecting && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
              <div className="text-center space-y-4">
                <div className="p-4 rounded-lg flex items-center justify-center relative bg-background">
                  <div
                    id="veridian-qr-container"
                    ref={qrContainerRef}
                    className="flex w-full items-center justify-center min-h-[256px]"
                  >
                    {!qrCodeReady && (
                      <div className="flex flex-col items-center gap-2">
                        <QrCode className="h-24 w-24 text-muted-foreground/50" />
                        <Spinner size={24} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("scanQRCode")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("scanDescription")}
                  </p>
                </div>

                {meerkatId && (
                  <div className="mt-4 w-full space-y-2">
                    <p className="text-xs text-muted-foreground text-center">
                      {t("cantScan")}
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                      <p className="flex-1 text-xs font-mono truncate">
                        {meerkatId}
                      </p>
                      <CopyButton value={meerkatId} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive font-medium">{t("error")}</p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={initializeCIP45}
              className="mt-3 w-full"
            >
              {t("tryAgain")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
