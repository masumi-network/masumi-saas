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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t.rich("description", {
            agentNetwork,
            currentNetwork,
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>
        <DialogFooter>
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
