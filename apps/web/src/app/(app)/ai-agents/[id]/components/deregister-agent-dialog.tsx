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
import { Spinner } from "@/components/ui/spinner";

interface DeregisterAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  agentName: string;
  isLoading?: boolean;
}

export function DeregisterAgentDialog({
  open,
  onOpenChange,
  onConfirm,
  agentName,
  isLoading = false,
}: DeregisterAgentDialogProps) {
  const t = useTranslations("App.Agents.Details");

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isLoading) return;
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className="w-sm gap-6">
        <DialogHeader>
          <DialogTitle>{t("deregisterConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("deregisterConfirmDescription", { name: agentName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            className="w-fit"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Spinner size={16} className="mr-2" />}
            {t("deregister")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
