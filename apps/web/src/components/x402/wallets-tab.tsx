"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useX402WalletsPaginated } from "@/lib/hooks/use-x402";
import { cn, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import type { X402Wallet } from "@/lib/x402/types";

import { EditWalletNoteDialog, WalletBalanceDialog } from "./wallet-extras";
import { X402DialogChrome, X402DialogHeader } from "./x402-form-dialog";

const PRIVATE_KEY_REGEX = /^0x[a-fA-F0-9]{64}$/;

type WalletType = X402Wallet["type"];
type KeySource = "generate" | "import";

export function WalletsTab() {
  const t = useTranslations("App.X402.Wallets");
  const queryClient = useQueryClient();
  const {
    wallets,
    isLoading,
    isRefetching,
    refetch,
    hasMore,
    isFetchingNextPage,
    loadMore,
  } = useX402WalletsPaginated();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [balanceWallet, setBalanceWallet] = useState<X402Wallet | null>(null);
  const [editWallet, setEditWallet] = useState<X402Wallet | null>(null);
  const [walletToRetire, setWalletToRetire] = useState<X402Wallet | null>(null);

  const confirmRetire = async () => {
    if (!walletToRetire) return;
    const id = walletToRetire.id;
    setRetiringId(id);
    const result = await x402Mutate<{ id: string }>(
      "/wallets/delete",
      { method: "POST", body: JSON.stringify({ id }) },
      { successMessage: t("retired"), errorMessage: t("retireFailed") },
    );
    setRetiringId(null);
    setWalletToRetire(null);
    if (result) {
      queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
      queryClient.invalidateQueries({ queryKey: ["x402", "budgets"] });
      queryClient.invalidateQueries({ queryKey: ["x402", "networks"] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="flex shrink-0 items-center gap-2">
          <RefreshButton onRefresh={refetch} isRefreshing={isRefetching} />
          <Button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("createWallet")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/30 dark:bg-muted/15">
            <tr className="border-b">
              {(["address", "type", "note", "created", "actions"] as const).map(
                (col) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn(
                      "p-4 text-sm font-medium text-muted-foreground",
                      col === "actions" ? "text-right" : "text-left",
                    )}
                  >
                    {t(`columns.${col}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : wallets.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                  />
                </td>
              </tr>
            ) : (
              wallets.map((wallet) => (
                <tr key={wallet.id} className="border-b last:border-0">
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm"
                        title={wallet.address}
                      >
                        {shortenAddress(wallet.address, 8)}
                      </span>
                      <CopyButton value={wallet.address} />
                    </div>
                  </td>
                  <td className="p-4 text-sm">{t(`types.${wallet.type}`)}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {wallet.note || (
                      <span className="italic opacity-60">
                        {t("emptyNote")}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(wallet.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBalanceWallet(wallet)}
                      >
                        <WalletIcon className="h-4 w-4" />
                        {t("balances")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("rename")}
                        onClick={() => setEditWallet(wallet)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={retiringId === wallet.id}
                        onClick={() => setWalletToRetire(wallet)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {retiringId === wallet.id ? t("retiring") : t("retire")}
                      </Button>
                    </div>
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

      <CreateWalletDialog
        key={dialogOpen ? "open" : "closed"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
          queryClient.invalidateQueries({ queryKey: ["x402", "budgets"] });
        }}
      />

      <WalletBalanceDialog
        key={balanceWallet ? `bal-${balanceWallet.id}` : "bal-closed"}
        wallet={balanceWallet}
        open={balanceWallet != null}
        onClose={() => setBalanceWallet(null)}
      />

      <EditWalletNoteDialog
        key={editWallet ? `note-${editWallet.id}` : "note-closed"}
        wallet={editWallet}
        open={editWallet != null}
        onClose={() => setEditWallet(null)}
        onSaved={() => {
          setEditWallet(null);
          queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
        }}
      />

      <ConfirmDialog
        open={walletToRetire !== null}
        onOpenChange={(open) => !open && setWalletToRetire(null)}
        title={t("retireTitle")}
        description={t("retireDescription")}
        onConfirm={confirmRetire}
        isLoading={retiringId !== null && retiringId === walletToRetire?.id}
        variant="destructive"
        confirmText={t("retire")}
      />
    </div>
  );
}

export function CreateWalletDialog({
  open,
  onClose,
  onSaved,
  defaultType = "Purchasing",
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultType?: WalletType;
}) {
  const t = useTranslations("App.X402.Wallets");
  const [type, setType] = useState<WalletType>(defaultType);
  const [keySource, setKeySource] = useState<KeySource>("generate");
  const [privateKey, setPrivateKey] = useState("");
  const [showImportKey, setShowImportKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [backup, setBackup] = useState<{
    address: string;
    privateKey: string;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = privateKey.trim();
    if (keySource === "import" && !PRIVATE_KEY_REGEX.test(trimmed)) {
      setError(t("invalidPrivateKey"));
      return;
    }
    setError(null);
    setIsSaving(true);
    const result = await x402Mutate<X402Wallet & { privateKey: string | null }>(
      "/wallets",
      {
        method: "POST",
        body: JSON.stringify(
          keySource === "import" ? { type, privateKey: trimmed } : { type },
        ),
      },
      {
        errorMessage: t("createFailed"),
      },
    );
    setIsSaving(false);
    if (!result) return;
    if (keySource === "generate") {
      if (result.privateKey) {
        setBackup({ address: result.address, privateKey: result.privateKey });
        return;
      }
      toast.error(t("missingPrivateKey"));
      onSaved();
      return;
    }
    toast.success(t("created"));
    onSaved();
  };

  return (
    <X402DialogChrome
      open={open}
      onClose={() => {
        if (!backup) onClose();
      }}
      maxWidthClassName="sm:max-w-[480px]"
      showCloseButton={!backup}
      onInteractOutside={backup ? (event) => event.preventDefault() : undefined}
      onEscapeKeyDown={backup ? (event) => event.preventDefault() : undefined}
    >
      {backup ? (
        <BackupKeyStep
          type={type}
          address={backup.address}
          privateKey={backup.privateKey}
          onDone={onSaved}
        />
      ) : (
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <X402DialogHeader
            title={t("createTitle")}
            description={t("createDescription")}
          />
          <DialogBody className="min-h-0 flex-1 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("direction")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: "Purchasing" as const,
                      icon: ShoppingCart,
                      hint: t("purchasingHint"),
                    },
                    {
                      value: "Selling" as const,
                      icon: Store,
                      hint: t("sellingHint"),
                    },
                  ] as const
                ).map((option) => {
                  const OptionIcon = option.icon;
                  const selected = type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setType(option.value)}
                      aria-pressed={selected}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <OptionIcon
                          className={cn(
                            "h-4 w-4",
                            selected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        {t(`directionLabels.${option.value}`)}
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("keySource")}</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1">
                {(
                  [
                    { value: "generate" as const, label: t("generateNew") },
                    { value: "import" as const, label: t("importExisting") },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setKeySource(tab.value);
                      setError(null);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      keySource === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {keySource === "generate" ? (
                <p className="text-xs leading-snug text-muted-foreground">
                  {t("generateHint")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Textarea
                      placeholder="0x…"
                      className="min-h-[76px] resize-none pr-10 font-mono text-xs"
                      autoComplete="off"
                      spellCheck={false}
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      style={
                        showImportKey
                          ? undefined
                          : ({
                              WebkitTextSecurity: "disc",
                              textSecurity: "disc",
                            } as React.CSSProperties)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1.5 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowImportKey((v) => !v)}
                      aria-label={showImportKey ? t("hideKey") : t("showKey")}
                    >
                      {showImportKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("importHint")}
                  </p>
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </DialogBody>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? t("creating") : t("createWallet")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </X402DialogChrome>
  );
}

function BackupKeyStep({
  type,
  address,
  privateKey,
  onDone,
}: {
  type: WalletType;
  address: string;
  privateKey: string;
  onDone: () => void;
}) {
  const t = useTranslations("App.X402.Wallets");
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);

  const performDownload = () => {
    setConfirmDownloadOpen(false);
    const contents = [
      "Masumi x402 managed wallet — PRIVATE KEY BACKUP",
      `Direction: ${type}`,
      `Address:   ${address}`,
      `Private key: ${privateKey}`,
      "",
      "Keep this file secret. Anyone with this key controls the wallet's funds.",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([contents], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `x402-wallet-${address.slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <X402DialogHeader
        title={t("backupTitle")}
        description={t("backupDescription")}
      />
      <DialogBody className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-snug text-amber-800 dark:text-amber-200">
            {t("backupWarning")}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="gap-1.5 px-2.5">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500" />
              {t("walletCreated")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t(`types.${type}`)}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <span
              className="flex-1 truncate font-mono text-xs text-muted-foreground"
              title={address}
            >
              {shortenAddress(address, 12)}
            </span>
            <CopyButton value={address} className="h-7 w-7 shrink-0" />
          </div>

          <div className="relative rounded-lg border border-dashed bg-muted/30 p-3">
            <p
              className={cn(
                "select-none break-all font-mono text-xs leading-relaxed text-foreground/80 transition-[filter]",
                !revealed && "blur-md",
              )}
              aria-hidden={!revealed}
            >
              {privateKey}
            </p>
            {!revealed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute inset-0 m-auto h-7 w-fit gap-1.5 px-3"
                onClick={() => setRevealed(true)}
              >
                <Eye className="h-3.5 w-3.5" /> {t("revealKey")}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> {t("hide")}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> {t("show")}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(privateKey);
                toast.success(t("keyCopied"));
              }}
            >
              <Copy className="h-3.5 w-3.5" /> {t("copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setConfirmDownloadOpen(true)}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> {t("download")}
            </Button>
          </div>
        </div>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
            confirmed
              ? "border-green-500/30 bg-green-500/5"
              : "border-border bg-muted/30",
          )}
        >
          <Checkbox
            checked={confirmed}
            onCheckedChange={(value) => setConfirmed(value === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed text-muted-foreground">
            {t("backupConfirm")}
          </span>
        </label>
      </DialogBody>

      <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
        <Button
          type="button"
          variant="primary"
          disabled={!confirmed}
          onClick={onDone}
          className="gap-1.5"
        >
          <Check className="h-4 w-4" /> {t("done")}
        </Button>
      </DialogFooter>

      <ConfirmDialog
        open={confirmDownloadOpen}
        onOpenChange={setConfirmDownloadOpen}
        title={t("downloadTitle")}
        description={t("downloadDescription")}
        onConfirm={performDownload}
        confirmText={t("download")}
      />
    </div>
  );
}
