"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

interface DeleteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  agentName: string;
  isLoading?: boolean;
}

export function DeleteAgentDialog({
  open,
  onOpenChange,
  onConfirm,
  agentName,
  isLoading = false,
}: DeleteAgentDialogProps) {
  const [confirmValue, setConfirmValue] = useState("");
  const t = useTranslations("App.Agents.Details");

  const isMatch = confirmValue.trim() === agentName;
  const canConfirm = isMatch && !isLoading;

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isLoading) return;
    if (!newOpen) setConfirmValue("");
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent
        className="w-sm max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <DialogDescription className="text-muted-foreground text-sm">
            {t("deleteConfirmDescription", { name: agentName })}
          </DialogDescription>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm-input">
              {t.rich("deleteConfirmTypeToConfirm", {
                name: agentName,
                bold: (chunks) => (
                  <span className="font-semibold">{chunks}</span>
                ),
              })}
            </Label>
            <Input
              id="delete-confirm-input"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder={t("deleteConfirmPlaceholder")}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter className="shrink-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
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
            disabled={!canConfirm}
          >
            {isLoading && <Spinner size={16} className="mr-2" />}
            {t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
