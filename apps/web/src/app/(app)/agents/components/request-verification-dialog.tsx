"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await agentApiClient.requestVerification(agent.id);
      if (result.success) {
        toast.success(t("requestSuccess"));
        onSuccess();
        onOpenChange(false);
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
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner size={16} className="mr-2" />}
            {t("submitRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
