"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useX402WalletBalances } from "@/lib/hooks/use-x402";
import { formatX402Amount } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import type { X402Wallet } from "@/lib/x402/types";

import { X402FormDialog, X402ViewDialog } from "./x402-form-dialog";

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
  const balances = query.data ?? [];

  return (
    <X402ViewDialog
      open={open}
      onClose={onClose}
      title={t("balanceTitle")}
      description={
        <span className="break-all font-mono text-xs">{wallet?.address}</span>
      }
      maxWidthClassName="sm:max-w-[520px]"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? t("refreshing") : t("refresh")}
          </Button>
          <Button type="button" variant="primary" onClick={onClose}>
            {t("close")}
          </Button>
        </>
      }
    >
      {query.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : query.isError ? (
        <p className="py-6 text-center text-sm text-destructive">
          {t("balanceError")}
        </p>
      ) : balances.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("balanceEmpty")}
        </p>
      ) : (
        <div className="space-y-3">
          {balances.map((balance) => (
            <div key={balance.caip2Network} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {balance.displayName}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {balance.caip2Network}
                </span>
              </div>
              {balance.error ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {balance.error}
                </p>
              ) : (
                <div className="space-y-1 text-sm">
                  {balance.native && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {balance.native.symbol}
                      </span>
                      <span className="font-mono">
                        {formatX402Amount(
                          balance.native.amount,
                          balance.native.decimals,
                        )}
                      </span>
                    </div>
                  )}
                  {balance.asset && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {balance.asset.symbol ?? "Token"}
                      </span>
                      <span className="font-mono">
                        {formatX402Amount(
                          balance.asset.amount,
                          balance.asset.decimals,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
