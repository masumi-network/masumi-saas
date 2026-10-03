"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const BATCH_DELETE_CONFIRM_PHRASE = "DELETE";

type BatchDeleteAgentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  count: number;
  isLoading?: boolean;
};

export function BatchDeleteAgentsDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isLoading = false,
}: BatchDeleteAgentsDialogProps) {
  const t = useTranslations("App.Agents");
  const [confirmValue, setConfirmValue] = useState("");

  const canConfirm =
    confirmValue.trim() === BATCH_DELETE_CONFIRM_PHRASE &&
    !isLoading &&
    count > 0;

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return;
    if (!next) setConfirmValue("");
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
            <DialogTitle>{t("batchDeleteTitle")}</DialogTitle>
          </DialogHeader>
        </div>
        <DialogBody stagger={false} className="flex flex-col gap-4 space-y-0">
          <DialogDescription className="text-sm text-muted-foreground">
            {t("batchDeleteDescription", { count })}
          </DialogDescription>
          <div className="space-y-2">
            <Label htmlFor="batch-delete-confirm">
              {t("batchDeleteTypeLabel")}
            </Label>
            <Input
              id="batch-delete-confirm"
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder={BATCH_DELETE_CONFIRM_PHRASE}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </DialogBody>
        <DialogFooter className="shrink-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => handleOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {isLoading ? <Spinner size={16} className="mr-2" /> : null}
            {t("batchDeleteConfirm", { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
