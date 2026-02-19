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
      <DialogContent className="w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteConfirmDescription", { name: agentName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="delete-confirm-input">
            {t.rich("deleteConfirmTypeToConfirm", {
              name: agentName,
              bold: (chunks) => <span className="font-semibold">{chunks}</span>,
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
        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="destructive"
            className="w-fit"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {isLoading && <Spinner size={16} className="mr-2" />}
            {t("delete")}
          </Button>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
