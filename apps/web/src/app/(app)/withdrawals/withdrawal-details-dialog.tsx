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
import { Separator } from "@/components/ui/separator";
import { formatDashboardEarningsTotal } from "@/lib/payment-node/format";
import type { WithdrawalDto } from "@/lib/types/withdrawal";

export type WithdrawalDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal: WithdrawalDto | null;
};

function statusLabelKey(
  status: WithdrawalDto["status"],
): "statusPending" | "statusCompleted" | "statusFailed" {
  if (status === "COMPLETED") {
    return "statusCompleted";
  }
  if (status === "FAILED") {
    return "statusFailed";
  }
  return "statusPending";
}

export function WithdrawalDetailsDialog({
  open,
  onOpenChange,
  withdrawal,
}: WithdrawalDetailsDialogProps) {
  const t = useTranslations("App.Withdrawals");
  const tDialog = useTranslations("Components.Dialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0">
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("detailsTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {t("detailsDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="max-h-[min(60vh,28rem)] flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!withdrawal ? (
            <p className="text-muted-foreground text-sm">
              {t("detailsUnavailable")}
            </p>
          ) : (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t("columnStatus")}
                  </dt>
                  <dd className="font-medium">
                    {t(statusLabelKey(withdrawal.status))}
                  </dd>
                </div>
                <Separator />
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t("columnAmount")}
                  </dt>
                  <dd className="font-mono text-base font-semibold tabular-nums">
                    {formatDashboardEarningsTotal(
                      Number.parseFloat(withdrawal.amountUsd),
                      "USD",
                    )}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t("columnNetwork")}
                  </dt>
                  <dd>{withdrawal.network}</dd>
                </div>
                {withdrawal.destinationLabel ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t("columnDestination")}
                    </dt>
                    <dd>{withdrawal.destinationLabel}</dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t("columnPayoutAddress")}
                  </dt>
                  <dd className="font-mono text-xs break-all">
                    {withdrawal.payoutAddress}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t("columnInitiated")}
                  </dt>
                  <dd>{new Date(withdrawal.createdAt).toLocaleString()}</dd>
                </div>
                {withdrawal.completedAt ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t("columnCompleted")}
                    </dt>
                    <dd>{new Date(withdrawal.completedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {withdrawal.failureReason ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t("columnFailureReason")}
                    </dt>
                    <dd className="text-destructive text-sm">
                      {withdrawal.failureReason}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tDialog("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
