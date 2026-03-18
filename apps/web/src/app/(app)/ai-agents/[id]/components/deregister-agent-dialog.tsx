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
      <DialogContent
        className="w-sm max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b border-border bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle>{t("deregisterConfirmTitle")}</DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <DialogDescription className="text-muted-foreground text-sm">
            {t("deregisterConfirmDescription", { name: agentName })}
          </DialogDescription>
        </div>
        <DialogFooter className="shrink-0 flex justify-end gap-2 border-t border-border bg-background px-6 py-4">
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
