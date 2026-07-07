"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { useX402WalletBalances } from "@/lib/hooks/use-x402";
import { cn, formatX402Amount, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import type { X402Wallet, X402WalletBalance } from "@/lib/x402/types";

import { ChainIcon } from "./chain-icon";
import { X402FormDialog, X402ViewDialog } from "./x402-form-dialog";

function BalanceSkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-border/60 bg-muted/20 p-4"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted/80" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-10 rounded-lg bg-muted/50" />
            <div className="h-10 rounded-lg bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function isZeroAmount(amount: string): boolean {
  try {
    return BigInt(amount) === 0n;
  } catch {
    return false;
  }
}

function BalanceAssetRow({
  symbol,
  amount,
  decimals,
}: {
  symbol: string;
  amount: string;
  decimals: number;
}) {
  const formatted = formatX402Amount(amount, decimals);
  const isZero = isZeroAmount(amount);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2.5">
      <span className="truncate text-sm text-muted-foreground">{symbol}</span>
      <span
        className={cn(
          "shrink-0 font-mono text-sm tabular-nums",
          isZero && "text-muted-foreground",
        )}
      >
        {formatted}
      </span>
    </div>
  );
}

function ChainBalanceCard({
  balance,
  iconSlug,
  index,
}: {
  balance: X402WalletBalance;
  iconSlug?: string | null;
  index: number;
}) {
  const t = useTranslations("App.X402.Wallets");
  const assets = [
    balance.native
      ? {
          key: "native",
          symbol: balance.native.symbol,
          amount: balance.native.amount,
          decimals: balance.native.decimals,
        }
      : null,
    balance.asset
      ? {
          key: "asset",
          symbol: balance.asset.symbol ?? "Token",
          amount: balance.asset.amount,
          decimals: balance.asset.decimals,
        }
      : null,
  ].filter((asset): asset is NonNullable<typeof asset> => asset != null);

  return (
    <article
      className="animate-table-row-in rounded-xl border border-border/70 bg-card/40 p-4 transition-[border-color,box-shadow,opacity] duration-300 hover:border-border hover:shadow-sm"
      style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="shrink-0 transition-[filter,opacity] duration-300">
          <ChainIcon
            caip2Id={balance.caip2Network}
            name={balance.displayName}
            iconSlug={iconSlug}
            size={32}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">
            {balance.displayName}
          </h3>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {balance.caip2Network}
          </p>
        </div>
      </div>

      {balance.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{balance.error}</span>
        </div>
      ) : assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyNote")}</p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <BalanceAssetRow
              key={asset.key}
              symbol={asset.symbol}
              amount={asset.amount}
              decimals={asset.decimals}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function WalletBalanceMeta({ wallet }: { wallet: X402Wallet }) {
  const t = useTranslations("App.X402.Wallets");

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(`types.${wallet.type}`)}</Badge>
        {wallet.note ? (
          <span className="truncate text-sm text-muted-foreground">
            {wallet.note}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center gap-1">
        <span className="font-mono text-sm" title={wallet.address}>
          {shortenAddress(wallet.address, 8)}
        </span>
        <CopyButton value={wallet.address} />
      </div>
    </div>
  );
}

export function WalletBalanceDialog({
  wallet,
  open,
  onClose,
}: {
  wallet: X402Wallet | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("App.X402.Wallets");
  const query = useX402WalletBalances(wallet?.id ?? null, open);
  const balances = useMemo(() => query.data ?? [], [query.data]);
  const caip2Ids = useMemo(
    () => balances.map((balance) => balance.caip2Network),
    [balances],
  );
  const chainIconSlugs = useChainRegistryIcons(caip2Ids);
  const isRefreshing = query.isFetching && !query.isLoading;

  return (
    <X402ViewDialog
      open={open}
      onClose={onClose}
      title={t("balanceTitle")}
      maxWidthClassName="sm:max-w-[520px]"
      bodyClassName="space-y-3"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4 transition-transform duration-300",
                query.isFetching && "animate-spin",
              )}
              aria-hidden
            />
            {query.isFetching ? t("refreshing") : t("refresh")}
          </Button>
          <Button type="button" variant="primary" onClick={onClose}>
            {t("close")}
          </Button>
        </>
      }
    >
      {wallet ? <WalletBalanceMeta wallet={wallet} /> : null}
      {query.isLoading ? (
        <BalanceSkeletonList />
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm text-destructive">{t("balanceError")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", query.isFetching && "animate-spin")}
              aria-hidden
            />
            {t("refresh")}
          </Button>
        </div>
      ) : balances.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("balanceEmpty")}
        </p>
      ) : (
        <div
          className={cn(
            "space-y-3 transition-opacity duration-300 ease-in-out",
            isRefreshing && "opacity-60",
          )}
        >
          {balances.map((balance, index) => (
            <ChainBalanceCard
              key={balance.caip2Network}
              balance={balance}
              iconSlug={chainIconSlugs.get(balance.caip2Network)}
              index={index}
            />
          ))}
        </div>
      )}
    </X402ViewDialog>
  );
}

export function EditWalletNoteDialog({
  wallet,
  open,
  onClose,
  onSaved,
}: {
  wallet: X402Wallet | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("App.X402.Wallets");
  const [note, setNote] = useState(wallet?.note ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setIsSaving(true);
    const result = await x402Mutate<X402Wallet>(
      "/wallets/update",
      {
        method: "POST",
        body: JSON.stringify({
          id: wallet.id,
          note: note.trim() === "" ? null : note.trim(),
        }),
      },
      { successMessage: t("updated"), errorMessage: t("updateFailed") },
    );
    setIsSaving(false);
    if (result) onSaved();
  };

  return (
    <X402FormDialog
      open={open}
      onClose={onClose}
      title={t("renameTitle")}
      description={
        <span className="break-all font-mono text-xs">{wallet?.address}</span>
      }
      onSubmit={submit}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? t("saving") : t("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("note")}</label>
        <Input
          placeholder={t("notePlaceholder")}
          maxLength={250}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </X402FormDialog>
  );
}
