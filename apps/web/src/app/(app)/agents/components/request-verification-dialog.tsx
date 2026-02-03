"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { VeridianWalletConnect } from "@/components/veridian";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

interface RequestVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null;
  onSuccess: () => void;
}

export function RequestVerificationDialog({
  open,
  onOpenChange,
  agent,
  kycStatus: _kycStatus,
  onSuccess,
}: RequestVerificationDialogProps) {
  const t = useTranslations("App.Agents.Details.Verification");
  const tStatus = useTranslations("App.Agents");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aid, setAid] = useState<string | null>(null);
  const [isFetchingCredentials, setIsFetchingCredentials] = useState(false);
  const [credentialsCount, setCredentialsCount] = useState<number | null>(null);
  const [expectedSchemaSaid, setExpectedSchemaSaid] = useState<string | null>(
    null,
  );
  const [hasExpectedCredential, setHasExpectedCredential] = useState<
    boolean | null
  >(null);
  const veridianConnectKeyRef = useRef(0);

  useEffect(() => {
    if (!open) {
      veridianConnectKeyRef.current += 1;
      setAid(null);
      setCredentialsCount(null);
      setExpectedSchemaSaid(null);
      setHasExpectedCredential(null);
    }
  }, [open]);

  const handleWalletConnect = async (connectedAid: string) => {
    setAid(connectedAid);
    setIsFetchingCredentials(true);

    try {
      const response = await fetch(
        `/api/test/veridian?aid=${encodeURIComponent(connectedAid)}`,
      );
      const data = await response.json();

      if (data.success) {
        const count = data.data.credentialsCount || 0;
        setCredentialsCount(count);
        setExpectedSchemaSaid(data.data.expectedSchemaSaid || null);
        setHasExpectedCredential(data.data.hasExpectedCredential ?? null);

        if (count === 0) {
          toast.info("No credentials found for this identifier");
        } else if (data.data.hasExpectedCredential) {
          toast.success(`Found required credential for agent verification`);
        } else {
          toast.warning(
            `Found ${count} credential(s), but the required credential for agent verification was not found`,
          );
        }
      } else {
        toast.error(data.error || "Failed to fetch credentials");
      }
    } catch (error) {
      console.error("Failed to fetch credentials:", error);
      toast.error("Failed to fetch credentials");
    } finally {
      setIsFetchingCredentials(false);
    }
  };

  const handleSubmit = async () => {
    if (!aid) {
      toast.error("Please connect your Veridian wallet first");
      return;
    }

    if (credentialsCount === 0) {
      toast.error(
        "No credentials found. Please ensure you have credentials issued to this identifier.",
      );
      return;
    }

    if (hasExpectedCredential === false) {
      toast.error(
        "Required credential for agent verification not found. Please ensure you have the correct credential issued to this identifier.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Backend will use the configured schema SAID, so we don't need to send it
      const result = await agentApiClient.requestVerification(agent.id, {
        aid,
      });
      if (result.success) {
        toast.success(t("requestSuccess"));
        onSuccess();
        onOpenChange(false);
        setAid(null);
        setCredentialsCount(null);
        setExpectedSchemaSaid(null);
        setHasExpectedCredential(null);
      } else {
        toast.error(result.error || t("requestError"));
      }
    } catch (error) {
      toast.error(t("requestError"));
      console.error("Failed to request verification:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("requestVerification")}</DialogTitle>
          <DialogDescription>{t("requestDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("agentInformation")}</h3>
            <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
              <div>
                <span className="text-xs text-muted-foreground">
                  {t("agentName")}
                </span>
                <p className="text-sm font-medium">{agent.name}</p>
              </div>
              <Separator />
              <div>
                <span className="text-xs text-muted-foreground">
                  {t("apiUrl")}
                </span>
                <p className="font-mono text-xs text-muted-foreground">
                  {agent.apiUrl}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("kycStatus")}</h3>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {tStatus("status.verified")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("kycStatusDescription")}
                </p>
              </div>
              <Badge
                variant="default"
                className="bg-green-500 text-white hover:bg-green-500/80"
              >
                {tStatus("status.approvedValue")}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              {t("veridianWalletConnection")}
            </h3>
            <VeridianWalletConnect
              key={veridianConnectKeyRef.current}
              onConnect={handleWalletConnect}
              onError={(error) => {
                toast.error(`Connection error: ${error}`);
              }}
            />
            {isFetchingCredentials && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size={16} />
                <span>{t("fetchingCredentials")}</span>
              </div>
            )}
            {aid && credentialsCount !== null && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("identifierAid")}
                  </p>
                  <p className="text-xs font-mono truncate">{aid}</p>
                </div>
                {credentialsCount > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("credentialsFound", { count: credentialsCount })}
                    </p>
                    {expectedSchemaSaid && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">
                          {t("requiredSchema")}
                        </p>
                        <p className="text-xs font-mono truncate">
                          {expectedSchemaSaid}
                        </p>
                        {hasExpectedCredential === true && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {t("requiredCredentialFound")}
                          </p>
                        )}
                        {hasExpectedCredential === false && (
                          <p className="text-xs text-destructive mt-1">
                            {t("requiredCredentialNotFound")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("whatWillBeIssued")}</h3>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                {t("credentialDescription")}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOnOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !aid || hasExpectedCredential === false}
          >
            {isSubmitting && <Spinner size={16} className="mr-2" />}
            {t("submitRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
