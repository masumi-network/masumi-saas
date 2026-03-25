"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount } from "@/lib/payment-node/format";
import { shortenAddress } from "@/lib/utils";

function cardanoTxExplorerUrl(network: string, txHash: string): string {
  const host =
    network === "Mainnet" ? "cardanoscan.io" : "preprod.cardanoscan.io";
  return `https://${host}/transaction/${txHash}`;
}

function formatActivityTimestamp(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number(value);
    const d = new Date(n > 1e12 ? n : n * 1000);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function humanizeNextAction(action: string | null | undefined): string {
  if (!action) return "—";
  const map: Record<string, string> = {
    None: "None",
    Ignore: "Ignore",
    WaitingForManualAction: "Waiting for manual action",
    WaitingForExternalAction: "Waiting for external action",
    SubmitResultRequested: "Submit result requested",
    SubmitResultInitiated: "Submit result in progress",
    WithdrawRequested: "Withdraw requested",
    WithdrawInitiated: "Withdraw initiated",
    AuthorizeRefundRequested: "Authorize refund requested",
    AuthorizeRefundInitiated: "Authorize refund in progress",
    FundsLockingRequested: "Funds locking requested",
    FundsLockingInitiated: "Funds locking initiated",
    SetRefundRequestedRequested: "Refund request initiated",
    SetRefundRequestedInitiated: "Refund request in progress",
    UnSetRefundRequestedRequested: "Unset refund requested",
    UnSetRefundRequestedInitiated: "Unset refund in progress",
    WithdrawRefundRequested: "Refund withdraw requested",
    WithdrawRefundInitiated: "Refund withdraw initiated",
  };
  return map[action] ?? action.replace(/([A-Z])/g, " $1").trim();
}

const EM_DASH = "\u2014";

function humanizeOnChainState(state: string | null | undefined): string {
  if (!state) return "—";
  const lower = state.toLowerCase();
  const pretty: Record<string, string> = {
    fundslocked: "Funds locked",
    resultsubmitted: "Result submitted",
    refundrequested: "Refund requested",
    refundwithdrawn: "Refund withdrawn",
    disputed: "Disputed",
    disputedwithdrawn: "Disputed withdrawn",
    withdrawn: "Withdrawn",
    fundsordatuminvalid: "Funds or datum invalid",
  };
  return (
    pretty[lower] ??
    state.charAt(0).toUpperCase() + state.slice(1).replace(/([A-Z])/g, " $1")
  );
}

type TransactionDetailPayload = {
  type: "payment" | "purchase";
  item: PaymentOrPurchaseItem;
};

export interface ActivityTransactionDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  transactionId: string | null;
  transactionType: "payment" | "purchase" | null;
  agentName: string | null;
  agentId: string | null;
}

export function ActivityTransactionDetailsDialog({
  open,
  onClose,
  transactionId,
  transactionType,
  agentName,
  agentId,
}: ActivityTransactionDetailsDialogProps) {
  const t = useTranslations("App.Activity.transactionDetails");
  const { network } = usePaymentNetwork();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["activity-transaction", transactionId, transactionType, network],
    enabled: open && Boolean(transactionId && transactionType),
    queryFn: async (): Promise<TransactionDetailPayload> => {
      const params = new URLSearchParams({
        network,
        id: transactionId!,
        type: transactionType!,
      });
      const res = await fetch(`/api/activity/transaction?${params.toString()}`);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: TransactionDetailPayload;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? t("loadError"));
      }
      return json.data;
    },
  });

  const item = data?.item;
  const txHash = item?.CurrentTransaction?.txHash ?? null;
  const extended = item as PaymentOrPurchaseItem & {
    inputHash?: string;
    resultHash?: string;
    externalDisputeUnlockTime?: string | null;
    lastCheckedAt?: string | null;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : t("loadError")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                {t("tryAgain")}
              </Button>
            </div>
          ) : item ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <h4 className="mb-1 text-sm font-semibold">
                    {t("transactionId")}
                  </h4>
                  <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
                    <p className="break-all font-mono text-xs">
                      {String(item.id)}
                    </p>
                    <CopyButton value={String(item.id)} />
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t("network")}</h4>
                  <p className="text-sm">
                    {item.PaymentSource?.network ?? network}
                  </p>
                </div>

                <div className="col-span-2">
                  <h4 className="mb-1 text-sm font-semibold">
                    {t("blockchainIdentifier")}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                    <span>
                      {item.blockchainIdentifier
                        ? shortenAddress(item.blockchainIdentifier, 8)
                        : EM_DASH}
                    </span>
                    {item.blockchainIdentifier ? (
                      <CopyButton value={item.blockchainIdentifier} />
                    ) : null}
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-sm font-semibold">
                    {t("agentName")}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {agentName ?? t("notAvailable")}
                  </p>
                </div>

                {item.agentIdentifier ? (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">
                      {t("agentIdentifier")}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span>{shortenAddress(item.agentIdentifier, 8)}</span>
                      <CopyButton value={item.agentIdentifier} />
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t("type")}</h4>
                  <p className="text-sm capitalize">{data?.type}</p>
                </div>

                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t("created")}</h4>
                  <p className="text-sm">
                    {formatActivityTimestamp(item.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("onChainSection")}</h4>
                <div className="rounded-md border bg-muted/20 p-4">
                  <p className="text-sm font-medium">
                    {humanizeOnChainState(item.onChainState ?? null)}
                  </p>
                  {item.NextAction?.requestedAction ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("nextAction")}{" "}
                      {humanizeNextAction(item.NextAction.requestedAction)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("amountSection")}</h4>
                <div className="rounded-md border bg-muted/20 p-4">
                  {data?.type === "payment" && item.RequestedFunds?.length ? (
                    <ul className="space-y-1 text-sm">
                      {item.RequestedFunds.map((f, i) => (
                        <li key={i}>{formatRequestedAmount([f])}</li>
                      ))}
                    </ul>
                  ) : data?.type === "purchase" && item.PaidFunds?.length ? (
                    <ul className="space-y-1 text-sm">
                      {item.PaidFunds.map((f, i) => (
                        <li key={i}>{formatRequestedAmount([f])}</li>
                      ))}
                    </ul>
                  ) : item.RequestedFunds?.length ? (
                    <ul className="space-y-1 text-sm">
                      {item.RequestedFunds.map((f, i) => (
                        <li key={i}>{formatRequestedAmount([f])}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{EM_DASH}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("txHash")}</h4>
                {txHash ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-center sm:justify-between">
                    <a
                      href={cardanoTxExplorerUrl(
                        item.PaymentSource?.network ?? network,
                        txHash,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-primary hover:underline"
                    >
                      {txHash}
                    </a>
                    <CopyButton value={txHash} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("noTxHash")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("timeSection")}</h4>
                <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("lastUpdated")}
                    </p>
                    <p>{formatActivityTimestamp(item.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("submitResultBy")}
                    </p>
                    <p>{formatActivityTimestamp(item.submitResultTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("unlockTime")}
                    </p>
                    <p>{formatActivityTimestamp(item.unlockTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("payBy")}
                    </p>
                    <p>{formatActivityTimestamp(item.payByTime)}</p>
                  </div>
                  {extended.externalDisputeUnlockTime != null ? (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("externalDisputeUnlock")}
                      </p>
                      <p>
                        {formatActivityTimestamp(
                          extended.externalDisputeUnlockTime,
                        )}
                      </p>
                    </div>
                  ) : null}
                  {extended.lastCheckedAt != null ? (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("lastChecked")}
                      </p>
                      <p>{formatActivityTimestamp(extended.lastCheckedAt)}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {(extended.inputHash || extended.resultHash) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    {t("hashesSection")}
                  </h4>
                  <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
                    {extended.inputHash ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("inputHash")}
                        </p>
                        <div className="mt-1 flex items-start gap-2">
                          <p className="break-all font-mono text-xs">
                            {extended.inputHash}
                          </p>
                          <CopyButton value={extended.inputHash} />
                        </div>
                      </div>
                    ) : null}
                    {extended.resultHash ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("resultHash")}
                        </p>
                        <div className="mt-1 flex items-start gap-2">
                          <p className="break-all font-mono text-xs">
                            {extended.resultHash}
                          </p>
                          <CopyButton value={extended.resultHash} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {item.NextAction?.errorType ? (
                <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-4">
                  <h4 className="text-sm font-semibold text-destructive">
                    {t("errorSection")}
                  </h4>
                  <p className="break-all text-sm">
                    <span className="font-medium">{t("errorType")}</span>{" "}
                    {item.NextAction.errorType}
                  </p>
                  {item.NextAction.errorNote ? (
                    <p className="break-all text-sm text-muted-foreground">
                      <span className="font-medium">{t("errorNote")}</span>{" "}
                      {item.NextAction.errorNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:justify-between">
          {agentId ? (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href={`/ai-agents/${agentId}`} onClick={onClose}>
                {t("viewAgent")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {item && !error ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isFetching}
                onClick={() => void refetch()}
                className="w-full sm:w-auto"
              >
                {t("refreshDetail")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              {t("close")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
