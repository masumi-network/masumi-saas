"use client";

import { ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

interface NetworkMismatchDialogProps {
  open: boolean;
  agentNetwork: PaymentNodeNetwork;
  currentNetwork: PaymentNodeNetwork;
  onSwitch: () => void;
  onBack: () => void;
}

export function NetworkMismatchDialog({
  open,
  agentNetwork,
  currentNetwork,
  onSwitch,
  onBack,
}: NetworkMismatchDialogProps) {
  const t = useTranslations("App.Agents.Details.networkMismatch");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onBack()}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {t.rich("description", {
              agentNetwork,
              currentNetwork,
              strong: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </p>
        </div>
        <DialogFooter className="shrink-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={onBack}>
            {t("back")}
          </Button>
          <Button variant="primary" onClick={onSwitch}>
            <ArrowLeftRight className="h-4 w-4" />
            {t("confirm", { network: agentNetwork })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
