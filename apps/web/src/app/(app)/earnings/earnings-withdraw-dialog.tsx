"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EarningsWithdrawDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EarningsWithdrawDialog({
  open,
  onOpenChange,
}: EarningsWithdrawDialogProps) {
  const t = useTranslations("App.Withdraw");
  const tDialog = useTranslations("Components.Dialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
          {t("comingSoon")}
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {tDialog("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
