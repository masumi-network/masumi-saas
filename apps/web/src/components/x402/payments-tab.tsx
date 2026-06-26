"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useX402Rail } from "@/lib/context/x402-rail-context";
import {
  useX402Networks,
  useX402PaymentAttempts,
  type X402PaymentFilters,
} from "@/lib/hooks/use-x402";
import { groupDigits, shortenAddress } from "@/lib/utils";
import type { X402PaymentAttempt } from "@/lib/x402/types";

import { X402ViewDialog } from "./x402-form-dialog";

const ALL = "__all__";

const STATUS_VARIANT: Record<
  X402PaymentAttempt["status"],
  BadgeProps["variant"]
> = {
  PaymentRequired: "pending",
  Verified: "processing",
  Settled: "success",
  Failed: "destructive",
  Replayed: "secondary",
};

export function PaymentsTab() {
  const t = useTranslations("App.X402.Payments");
  const { networks } = useX402Networks();
  const { activeRail, selectedX402ChainId } = useX402Rail();
  const [filters, setFilters] = useState<X402PaymentFilters>({});
  const [selected, setSelected] = useState<X402PaymentAttempt | null>(null);

  const selectedCaip2 = networks.find(
    (n) => n.id === selectedX402ChainId,
  )?.caip2Id;
  const lastAppliedCaip2 = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (activeRail !== "x402") return;
    if (!selectedX402ChainId) {
      if (lastAppliedCaip2.current !== undefined) {
        lastAppliedCaip2.current = undefined;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Clears stale chain scope when sidebar selection is cleared.
        setFilters((prev) =>
          prev.caip2Network ? { ...prev, caip2Network: undefined } : prev,
        );
      }
      return;
    }
    if (!selectedCaip2) return;
    if (lastAppliedCaip2.current === selectedCaip2) return;
    lastAppliedCaip2.current = selectedCaip2;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync payment list filter with sidebar chain selection.
    setFilters((prev) =>
      prev.caip2Network === selectedCaip2
        ? prev
        : { ...prev, caip2Network: selectedCaip2 },
    );
  }, [activeRail, selectedX402ChainId, selectedCaip2]);

  const {
    attempts,
    isLoading,
    hasMore,
    loadMore,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useX402PaymentAttempts(filters);

  const chainLabel = (caip2: string) =>
    networks.find((n) => n.caip2Id === caip2)?.displayName ?? caip2;

  const statusOptions: X402PaymentAttempt["status"][] = [
    "PaymentRequired",
    "Verified",
    "Settled",
    "Failed",
    "Replayed",
  ];
  const directionOptions: X402PaymentAttempt["direction"][] = [
    "InboundVerify",
    "InboundSettle",
    "OutboundPayment",
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.status ?? ALL}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status:
                  value === ALL
                    ? undefined
                    : (value as X402PaymentAttempt["status"]),
              }))
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={t("allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.direction ?? ALL}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                direction:
                  value === ALL
                    ? undefined
                    : (value as X402PaymentAttempt["direction"]),
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("allDirections")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allDirections")}</SelectItem>
              {directionOptions.map((direction) => (
                <SelectItem key={direction} value={direction}>
                  {t(`directions.${direction}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.caip2Network ?? ALL}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                caip2Network: value === ALL ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={t("allChains")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allChains")}</SelectItem>
              {networks.map((network) => (
                <SelectItem key={network.id} value={network.caip2Id}>
                  {network.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <RefreshButton onRefresh={refetch} isRefreshing={isRefetching} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/30 dark:bg-muted/15">
            <tr className="border-b">
              {(
                [
                  "direction",
                  "status",
                  "chain",
                  "amount",
                  "asset",
                  "created",
                ] as const
              ).map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={`p-4 text-sm font-medium text-muted-foreground ${
                    col === "amount" ? "text-right" : "text-left"
                  }`}
                >
                  {t(`columns.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : attempts.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                  />
                </td>
              </tr>
            ) : (
              attempts.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  onClick={() => setSelected(attempt)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(attempt);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={t("viewDetails")}
                >
                  <td className="p-4 text-sm">
                    {t(`directions.${attempt.direction}`)}
                  </td>
                  <td className="p-4">
                    <Badge variant={STATUS_VARIANT[attempt.status]}>
                      {attempt.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm">
                    {chainLabel(attempt.caip2Network)}
                  </td>
                  <td className="p-4 text-right font-mono text-sm">
                    {groupDigits(attempt.amount)}
                  </td>
                  <td className="p-4 font-mono text-sm">
                    {shortenAddress(attempt.asset, 6)}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(attempt.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? t("loading") : t("loadMore")}
          </Button>
        </div>
      )}

      <PaymentDetailsDialog
        attempt={selected}
        chainLabel={selected ? chainLabel(selected.caip2Network) : ""}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function PaymentDetailsDialog({
  attempt,
  chainLabel,
  onClose,
}: {
  attempt: X402PaymentAttempt | null;
  chainLabel: string;
  onClose: () => void;
}) {
  const t = useTranslations("App.X402.Payments");
  const tDialog = useTranslations("Components.Dialog");

  return (
    <X402ViewDialog
      open={!!attempt}
      onClose={onClose}
      title={t("detailsTitle")}
      description={t("detailsDescription")}
      maxWidthClassName="sm:max-w-lg"
      footer={
        <Button type="button" variant="primary" onClick={onClose}>
          {tDialog("close")}
        </Button>
      }
    >
      {attempt && (
        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <DetailRow
              label={t("fields.direction")}
              value={t(`directions.${attempt.direction}`)}
            />
            <DetailRow
              label={t("fields.status")}
              value={
                <Badge variant={STATUS_VARIANT[attempt.status]}>
                  {attempt.status}
                </Badge>
              }
            />
            <DetailRow label={t("fields.chain")} value={chainLabel} />
            <DetailRow label={t("fields.amount")} value={attempt.amount} mono />
            <DetailRow label={t("fields.asset")} value={attempt.asset} mono />
            <DetailRow label={t("fields.payTo")} value={attempt.payTo} mono />
            {attempt.payer && (
              <DetailRow label={t("fields.payer")} value={attempt.payer} mono />
            )}
            {attempt.resource && (
              <DetailRow
                label={t("fields.resource")}
                value={attempt.resource}
                mono
              />
            )}
            {attempt.paymentIdentifier && (
              <DetailRow
                label={t("fields.paymentIdentifier")}
                value={attempt.paymentIdentifier}
                mono
              />
            )}
            <DetailRow
              label={t("fields.created")}
              value={new Date(attempt.createdAt).toLocaleString()}
            />
          </div>

          {attempt.errorReason && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                {attempt.errorReason}
              </p>
              {attempt.errorMessage && (
                <p className="text-xs text-muted-foreground">
                  {attempt.errorMessage}
                </p>
              )}
            </div>
          )}

          {attempt.Settlement && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">{t("settlement")}</p>
              <DetailRow
                label={t("fields.result")}
                value={
                  <Badge
                    variant={
                      attempt.Settlement.success ? "success" : "destructive"
                    }
                  >
                    {attempt.Settlement.success ? t("success") : t("failed")}
                  </Badge>
                }
              />
              {attempt.Settlement.txHash && (
                <div className="flex items-center justify-between gap-4 border-b py-1.5">
                  <span className="text-sm text-muted-foreground">
                    {t("fields.transaction")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-sm">
                      {shortenAddress(attempt.Settlement.txHash, 8)}
                    </span>
                    <CopyButton value={attempt.Settlement.txHash} />
                  </span>
                </div>
              )}
              {attempt.Settlement.amount && (
                <DetailRow
                  label={t("fields.amount")}
                  value={attempt.Settlement.amount}
                  mono
                />
              )}
              {attempt.Settlement.payer && (
                <DetailRow
                  label={t("fields.payer")}
                  value={attempt.Settlement.payer}
                  mono
                />
              )}
            </div>
          )}
        </div>
      )}
    </X402ViewDialog>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          mono ? "break-all text-right font-mono text-sm" : "text-right text-sm"
        }
      >
        {value}
      </span>
    </div>
  );
}
