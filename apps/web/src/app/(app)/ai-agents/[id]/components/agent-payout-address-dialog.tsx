"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

export function AgentPayoutAddressDialog({
  agent,
  open,
  onOpenChange,
  onUpdated,
}: {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (agent: Agent) => void;
}) {
  const t = useTranslations("App.Agents.Details");
  const tRegister = useTranslations("App.Agents.Register");
  const { network } = usePaymentNetwork();
  const [value, setValue] = useState(agent.payoutAddress ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return;
    if (nextOpen) {
      setValue(agent.payoutAddress ?? "");
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await agentApiClient.updatePayoutAddress(agent.id, value);
      if (!result.success || !result.data) {
        toast.error(result.error ?? t("payoutAddressUpdateError"));
        return;
      }
      toast.success(t("payoutAddressUpdated"));
      onUpdated(result.data);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-sm max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div
          className={cn(
            "shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12",
            dialogHeaderEnterClass,
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("payoutAddressDialogTitle")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <DialogBody stagger={false} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="agent-payout-address">{t("payoutAddress")}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                  <CircleHelp className="h-3.5 w-3.5" />
                  <span className="sr-only">
                    {tRegister("payoutAddressHint")}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {tRegister("payoutAddressHint")}
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="agent-payout-address"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={tRegister(
              network === "Mainnet"
                ? "payoutAddressPlaceholderMainnet"
                : "payoutAddressPlaceholderPreprod",
            )}
            className="h-11 font-mono text-sm"
            spellCheck={false}
            autoComplete="off"
            disabled={isSaving}
          />
        </DialogBody>

        <DialogFooter className="shrink-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {tRegister("cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="w-fit"
            onClick={() => void handleSave()}
            disabled={isSaving || !value.trim()}
          >
            {isSaving ? <Spinner size={16} className="mr-2" /> : null}
            {t("payoutAddressSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
