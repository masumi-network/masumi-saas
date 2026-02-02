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
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrDivRef = useRef<HTMLDivElement | null>(null);
  const dAppConnectRef = useRef<DAppPeerConnect | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clean up the QR code div from the DOM
   * Safely removes the QR code element if it exists
   */
  const cleanupQRCode = () => {
    if (
      qrDivRef.current &&
      qrContainerRef.current?.contains(qrDivRef.current)
    ) {
      try {
        qrContainerRef.current.removeChild(qrDivRef.current);
      } catch (err) {
        // Ignore errors if already removed
        console.debug("QR div cleanup error:", err);
      }
      qrDivRef.current = null;
    }
  };

  const initializeCIP45 = async () => {
    if (typeof window === "undefined") return;

    try {
      setIsConnecting(true);
      setError(null);

      // Dynamic import to avoid SSR issues
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
          callback(true, true, walletInfo); // Auto-accept connection
        },
        onApiInject: async (injectedWalletName: string) => {
          console.log("CIP-45 API injected:", injectedWalletName);
          setWalletName(injectedWalletName);
          // Store the wallet name, but wait for onConnect to actually connect
          // The API is injected but not yet enabled until user confirms
        },
        onConnect: async (address: string, walletInfo: unknown) => {
          console.log("CIP-45 connected", address, walletInfo);
          setIsConnecting(false);
          setIsConnected(true);

          // Store wallet name
          const walletInfoObj = walletInfo as { name?: string } | null;
          const connectedWalletName = walletInfoObj?.name || "idw_p2p";
          setWalletName(connectedWalletName);

          // Poll for API availability (API might not be immediately available)
          const start = Date.now();
          const interval = 100;
          const timeout = 10000; // 10 second timeout for onConnect

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
                      // Clear timeout on successful connection
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

              // Fallback: try to get identifier from walletInfo
              const walletInfoObj = walletInfo as {
                identifier?: string;
                aid?: string;
              } | null;
              const identifier =
                walletInfoObj?.identifier || walletInfoObj?.aid;
              if (identifier) {
                setAid(identifier);
                onConnect(identifier);
                // Clear timeout on successful connection
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
          dAppConnectRef.current = null;
        },
      });

      dAppConnectRef.current = dAppConnectInstance;

      // Get and store meerkat ID for manual entry
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

      // Generate QR code for wallet connection
      try {
        if (qrContainerRef.current) {
          // Clean up any existing QR code div
          cleanupQRCode();

          // Create a separate div for QR code (not managed by React)
          const qrDiv = document.createElement("div");
          qrDiv.style.width = "256px";
          qrDiv.style.height = "256px";
          qrDiv.style.display = "flex";
          qrDiv.style.alignItems = "center";
          qrDiv.style.justifyContent = "center";

          // Generate QR code into the separate div
          await dAppConnectInstance.generateQRCode(qrDiv);

          // Append the QR div to the container
          qrContainerRef.current.appendChild(qrDiv);
          qrDivRef.current = qrDiv;
        }
      } catch (qrError) {
        console.error("QR code generation error:", qrError);
        const errorMsg = t("failedToGenerateQR");
        setError(errorMsg);
        onError?.(errorMsg);
      }

      // Set timeout to prevent infinite pending state
      timeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          console.log("Connection timeout");
          setIsConnecting(false);
          const errorMsg = t("connectionTimeout");
          setError(errorMsg);
          onError?.(errorMsg);
        }
      }, 30000); // 30 second timeout
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
    if (dAppConnectRef.current) {
      // Disconnect logic if needed
      setIsConnected(false);
      setAid(null);
      setWalletName(null);
      setMeerkatId(null);
      cleanupQRCode();
      dAppConnectRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
                    {!qrDivRef.current && (
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

            <Button
              variant="outline"
              onClick={() => {
                setIsConnecting(false);
                setMeerkatId(null);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                }
                cleanupQRCode();
                dAppConnectRef.current = null;
              }}
              className="w-full"
            >
              {t("cancel")}
            </Button>
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
