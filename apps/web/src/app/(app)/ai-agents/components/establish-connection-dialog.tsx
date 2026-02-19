"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { credentialApiClient } from "@/lib/api/credential.client";

interface EstablishConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aid: string | null;
  onConnectionEstablished: () => void;
}

export function EstablishConnectionDialog({
  open,
  onOpenChange,
  aid,
  onConnectionEstablished,
}: EstablishConnectionDialogProps) {
  const t = useTranslations("App.Agents.Details.Verification");
  const [issuerOobi, setIssuerOobi] = useState<string | null>(null);
  const [isLoadingIssuerOobi, setIsLoadingIssuerOobi] = useState(false);
  const [connectionExists, setConnectionExists] = useState<boolean | null>(
    null,
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const lastCheckedAidRef = useRef<string | null>(null);

  const checkConnection = useCallback(
    async (aidToCheck: string, force = false) => {
      if (!force && lastCheckedAidRef.current === aidToCheck) {
        return;
      }

      setIsCheckingConnection(true);
      if (force) {
        lastCheckedAidRef.current = null;
      } else {
        lastCheckedAidRef.current = aidToCheck;
      }
      try {
        const result = await credentialApiClient.checkConnection(aidToCheck);
        if (result.success) {
          setConnectionExists(result.data.exists);
          lastCheckedAidRef.current = aidToCheck;
          if (result.data.exists) {
            onConnectionEstablished();
          }
        } else {
          console.error("Failed to check connection:", result.error);
          setConnectionExists(null);
          lastCheckedAidRef.current = null;
        }
      } catch (error) {
        console.error("Failed to check connection:", error);
        setConnectionExists(null);
        lastCheckedAidRef.current = null;
      } finally {
        setIsCheckingConnection(false);
      }
    },
    [onConnectionEstablished],
  );

  useEffect(() => {
    if (open && aid) {
      const fetchIssuerOobi = async () => {
        setIsLoadingIssuerOobi(true);
        try {
          const result = await credentialApiClient.getIssuerOobi();
          if (result.success) {
            setIssuerOobi(result.data.oobi);
          } else {
            console.error("Failed to fetch issuer OOBI:", result.error);
          }
        } catch (error) {
          console.error("Failed to fetch issuer OOBI:", error);
        } finally {
          setIsLoadingIssuerOobi(false);
        }
      };
      fetchIssuerOobi();
      checkConnection(aid);
    } else {
      setIssuerOobi(null);
      setConnectionExists(null);
      lastCheckedAidRef.current = null;
    }
  }, [open, aid, checkConnection]);

  if (!aid) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("establishConnection")}</DialogTitle>
          <DialogDescription>
            {t("establishConnectionDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoadingIssuerOobi ? (
            <div className="flex items-center justify-center p-8">
              <Spinner size={24} />
            </div>
          ) : issuerOobi ? (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-lg flex items-center justify-center relative bg-background border">
                <QRCode
                  value={issuerOobi}
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
              <p className="text-xs text-muted-foreground text-center">
                {t("scanIssuerQRCode")}
              </p>

              {isCheckingConnection ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size={16} />
                  <span>{t("checkingConnection")}</span>
                </div>
              ) : connectionExists === false ? (
                <div className="w-full space-y-2">
                  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                      {t("connectionNotEstablished")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkConnection(aid, true)}
                    className="w-full"
                  >
                    {t("checkConnectionAgain")}
                  </Button>
                </div>
              ) : connectionExists === true ? (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 w-full">
                  <p className="text-xs text-green-600 dark:text-green-400 text-center">
                    {t("connectionEstablished")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                {t("failedToLoadIssuerOobi")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
