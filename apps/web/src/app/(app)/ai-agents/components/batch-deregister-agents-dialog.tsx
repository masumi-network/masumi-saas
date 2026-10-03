"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type BatchDeregisterAgentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  count: number;
  isLoading?: boolean;
};

export function BatchDeregisterAgentsDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isLoading = false,
}: BatchDeregisterAgentsDialogProps) {
  const t = useTranslations("App.Agents");

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-sm flex-col gap-0 overflow-hidden p-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle>{t("batchDeregisterTitle")}</DialogTitle>
          </DialogHeader>
        </div>
        <DialogBody stagger={false}>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("batchDeregisterDescription", { count })}
          </DialogDescription>
        </DialogBody>
        <DialogFooter className="shrink-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isLoading || count === 0}
            onClick={onConfirm}
          >
            {isLoading ? <Spinner size={16} className="mr-2" /> : null}
            {t("batchDeregisterConfirm", { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
