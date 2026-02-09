"use client";

import { useCardano } from "@cardano-foundation/cardano-connect-with-wallet";
import { NetworkType } from "@cardano-foundation/cardano-connect-with-wallet-core";
import { Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

interface IWalletInfoExtended {
  name: string;
  address: string;
  oobi: string;
}

interface VeridianWalletConnectProps {
  onConnect: (aid: string) => void;
  onError?: (error: string) => void;
  appName?: string;
  className?: string;
}

const defaultWallet: IWalletInfoExtended = {
  name: "",
  address: "",
  oobi: "",
};

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
  const [showAcceptButton, setShowAcceptButton] = useState(false);
  const [error, setError] = useState<string>("");

  const [peerConnectWalletInfo, setPeerConnectWalletInfo] =
    useState<IWalletInfoExtended>(defaultWallet);

  const [onPeerConnectAccept, setOnPeerConnectAccept] = useState<() => void>(
    () => () => {},
  );
  const [onPeerConnectReject, setOnPeerConnectReject] = useState<() => void>(
    () => () => {},
  );

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { dAppConnect, meerkatAddress, initDappConnect, disconnect, connect } =
    useCardano({
      limitNetwork: NetworkType.TESTNET,
    });

  const pollForApi = (walletName: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const start = Date.now();
    const interval = 100;
    const timeout = 5000;

    const checkApi = setInterval(async () => {
      const api = (window as { cardano?: Record<string, unknown> }).cardano?.[
        walletName
      ];
      if (api || Date.now() - start > timeout) {
        clearInterval(checkApi);
        pollingIntervalRef.current = null;
        if (api) {
          try {
            const enabledApi = (await (
              api as {
                enable: () => Promise<{
                  experimental?: {
                    getKeriIdentifier?: () => Promise<{
                      id: string;
                      oobi: string;
                    }>;
                  };
                }>;
              }
            ).enable()) as {
              experimental?: {
                getKeriIdentifier?: () => Promise<{ id: string; oobi: string }>;
              };
            };
            const keriIdentifier =
              await enabledApi.experimental?.getKeriIdentifier?.();
            if (keriIdentifier && keriIdentifier.id) {
              setPeerConnectWalletInfo((prev) => ({
                ...prev,
                address: keriIdentifier.id,
                oobi: keriIdentifier.oobi,
              }));
              setShowAcceptButton(false);
              setError("");
              onConnect(keriIdentifier.id);
            }
          } catch {
            setError("Failed to get KERI identifier");
            onError?.("Failed to get KERI identifier");
          }
        } else {
          setError(`Timeout while connecting P2P ${walletName} wallet`);
        }
      }
    }, interval);

    pollingIntervalRef.current = checkApi;
  };

  useEffect(() => {
    if (dAppConnect.current === null) {
      const verifyConnection = (
        walletInfo: IWalletInfoExtended,
        callback: (granted: boolean, autoconnect: boolean) => void,
      ) => {
        setPeerConnectWalletInfo(walletInfo);
        setShowAcceptButton(true);

        setOnPeerConnectAccept(() => () => callback(true, true));
        setOnPeerConnectReject(() => () => callback(false, false));
      };

      const onApiInject = async (name: string) => {
        const api = (window as { cardano?: Record<string, unknown> }).cardano?.[
          name
        ];
        if (api) {
          const enabledApi = (await (
            api as {
              enable: () => Promise<{
                experimental?: {
                  getKeriIdentifier?: () => Promise<{
                    id: string;
                    oobi: string;
                  }>;
                };
              }>;
            }
          ).enable()) as {
            experimental?: {
              getKeriIdentifier?: () => Promise<{ id: string; oobi: string }>;
            };
          };
          const keriIdentifier =
            await enabledApi.experimental?.getKeriIdentifier?.();

          if (keriIdentifier && keriIdentifier.id) {
            setPeerConnectWalletInfo((prev) => ({
              ...prev,
              name: name,
              address: keriIdentifier.id,
              oobi: keriIdentifier.oobi,
            }));

            setError("");
            onConnect(keriIdentifier.id);
          }
        } else {
          setError(`Timeout while connecting P2P ${name} wallet`);
        }
      };

      const onApiEject = (): void => {
        setPeerConnectWalletInfo(defaultWallet);
        setError("");
        disconnect();
        setShowAcceptButton(false);
      };

      const onP2PConnect = (): void => {};

      initDappConnect(
        appName,
        window.location.href,
        verifyConnection,
        onApiInject,
        onApiEject,
        [
          "wss://tracker.webtorrent.dev:443/announce",
          "wss://dev.btt.cf-identity-wallet.metadata.dev.cf-deployments.org",
        ],
        onP2PConnect,
      );
    }

    // Cleanup polling interval on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [appName, initDappConnect, disconnect, onConnect, dAppConnect]);

  const disconnectWallet = () => {
    disconnect();
    setPeerConnectWalletInfo(defaultWallet);
    setShowAcceptButton(false);
    setError("");
  };

  const handleAcceptWallet = () => {
    if (peerConnectWalletInfo) {
      onPeerConnectAccept();
      connect(peerConnectWalletInfo.name)
        .then(async () => {
          if (peerConnectWalletInfo.name === "idw_p2p") {
            pollForApi(peerConnectWalletInfo.name);
          } else {
            setError(`Wrong wallet: ${peerConnectWalletInfo.name}`);
          }
        })
        .catch(() => {
          if (peerConnectWalletInfo.name === "idw_p2p") {
            pollForApi(peerConnectWalletInfo.name);
          }
        });
    }
  };

  if (
    peerConnectWalletInfo.address &&
    peerConnectWalletInfo.address.length > 0
  ) {
    return (
      <div className={className}>
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("connected")}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {peerConnectWalletInfo.address}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={disconnectWallet}
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
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
          <div className="text-center space-y-4">
            {meerkatAddress && (
              <div className="p-4 rounded-lg flex items-center justify-center relative bg-background">
                <QRCode
                  value={meerkatAddress}
                  size={256}
                  fgColor={"black"}
                  bgColor={"white"}
                  qrStyle={"squares"}
                  logoImage="/assets/qr-logo.png"
                  logoWidth={60}
                  logoHeight={60}
                  logoOpacity={1}
                  quietZone={10}
                />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("scanQRCode")}</p>
              <p className="text-xs text-muted-foreground">
                {t("scanDescription")}
              </p>
            </div>

            {meerkatAddress && (
              <div className="mt-4 w-full space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  {t("cantScan")}
                </p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                  <p className="flex-1 text-xs font-mono truncate">
                    {meerkatAddress}
                  </p>
                  <CopyButton value={meerkatAddress} />
                </div>
              </div>
            )}

            {showAcceptButton && peerConnectWalletInfo && (
              <div className="mt-4 w-full space-y-2">
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-sm font-medium text-center">
                    {t("connectionRequest")}
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t("walletName")}
                      {": "}
                      {peerConnectWalletInfo.name || "Unknown"}
                    </p>
                    {peerConnectWalletInfo.address && (
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {peerConnectWalletInfo.address}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleAcceptWallet}
                      className="flex-1"
                    >
                      {t("accept")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onPeerConnectReject();
                        setShowAcceptButton(false);
                        setPeerConnectWalletInfo(defaultWallet);
                      }}
                      className="flex-1"
                    >
                      {t("reject")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive font-medium">{t("error")}</p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
