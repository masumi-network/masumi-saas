"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  ListFilter,
  MoreVertical,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormatDate } from "@/hooks/use-format-date";
import { useX402WalletsPaginated } from "@/lib/hooks/use-x402";
import { cn, shortenAddress } from "@/lib/utils";
import { x402Fetch, x402Mutate } from "@/lib/x402/api";
import type { X402Wallet } from "@/lib/x402/types";

import { EditWalletNoteDialog, WalletBalanceDialog } from "./wallet-extras";
import { X402DialogChrome, X402DialogHeader } from "./x402-form-dialog";
import {
  x402ActionsCellClass,
  x402ActionsHeadClass,
  X402TableEmptyState,
  X402TableLoading,
  X402TableSearch,
} from "./x402-table-ui";

const PRIVATE_KEY_REGEX = /^0x[a-fA-F0-9]{64}$/;
const FILTER_ALL = "__all__";

type WalletListFilters = {
  type?: WalletType;
};

type WalletType = X402Wallet["type"];
type KeySource = "generate" | "import";

function defaultWalletNoteForType(
  type: WalletType,
  t: (key: "defaultNotePurchasing" | "defaultNoteSelling") => string,
): string {
  return type === "Purchasing"
    ? t("defaultNotePurchasing")
    : t("defaultNoteSelling");
}

export function getWalletSlotAvailability(
  wallets: ReadonlyArray<{ type: WalletType }>,
) {
  const hasPurchasing = wallets.some((wallet) => wallet.type === "Purchasing");
  const hasSelling = wallets.some((wallet) => wallet.type === "Selling");

  return {
    hasPurchasing,
    hasSelling,
    canCreate: !hasPurchasing || !hasSelling,
    defaultType: (!hasSelling ? "Selling" : "Purchasing") as WalletType,
    blockedTypes: [
      ...(hasPurchasing ? (["Purchasing"] as const) : []),
      ...(hasSelling ? (["Selling"] as const) : []),
    ] as WalletType[],
  };
}

export function WalletsTab() {
  const t = useTranslations("App.X402.Wallets");
  const { formatRelativeDate } = useFormatDate();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilters, setListFilters] = useState<WalletListFilters>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [balanceWallet, setBalanceWallet] = useState<X402Wallet | null>(null);
  const [editWallet, setEditWallet] = useState<X402Wallet | null>(null);
  const [walletToRetire, setWalletToRetire] = useState<X402Wallet | null>(null);
  const slotAvailability = useMemo(
    () => getWalletSlotAvailability(wallets),
    [wallets],
  );

  const activeFilterCount = useMemo(
    () => (listFilters.type !== undefined ? 1 : 0),
    [listFilters],
  );

  const filteredWallets = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return wallets.filter((wallet) => {
      if (listFilters.type !== undefined && wallet.type !== listFilters.type) {
        return false;
      }

      if (!query) return true;

      const typeLabel = t(`types.${wallet.type}`).toLowerCase();

      return (
        wallet.address.toLowerCase().includes(query) ||
        wallet.note?.toLowerCase().includes(query) ||
        typeLabel.includes(query)
      );
    });
  }, [debouncedSearch, listFilters, t, wallets]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const clearFilters = () => setListFilters({});

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
      void queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["x402", "budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["x402", "networks"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <X402TableSearch
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("searchPlaceholder")}
          shortcutLabel={t("searchShortcut")}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <WalletsFiltersPopover
            filters={listFilters}
            activeFilterCount={activeFilterCount}
            onChange={setListFilters}
            onClear={clearFilters}
          />
          <RefreshButton
            onRefresh={refetch}
            isRefreshing={isRefetching}
            size="md"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex md:hidden">
                <Button
                  onClick={() => setDialogOpen(true)}
                  size="icon"
                  disabled={!slotAvailability.canCreate}
                  aria-label={t("createWallet")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            {!slotAvailability.canCreate ? (
              <TooltipContent>{t("bothWalletsExist")}</TooltipContent>
            ) : null}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden md:inline-flex">
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="items-center gap-2"
                  disabled={!slotAvailability.canCreate}
                >
                  <Plus className="h-4 w-4" />
                  {t("createWallet")}
                </Button>
              </span>
            </TooltipTrigger>
            {!slotAvailability.canCreate ? (
              <TooltipContent>{t("bothWalletsExist")}</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <WalletsActiveFilters filters={listFilters} onClear={clearFilters} />
      ) : null}

      {isLoading ? (
        <X402TableLoading columns={4} withActions />
      ) : wallets.length === 0 ? (
        <X402TableEmptyState
          icon={WalletIcon}
          message={`${t("emptyTitle")}. ${t("emptyDescription")}`}
        />
      ) : filteredWallets.length === 0 ? (
        <X402TableEmptyState icon={WalletIcon} message={t("noSearchResults")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {(["address", "type", "note", "created"] as const).map(
                  (col) => (
                    <TableHead key={col}>{t(`columns.${col}`)}</TableHead>
                  ),
                )}
                <TableHead className={x402ActionsHeadClass}>
                  {t("columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWallets.map((wallet, index) => (
                <TableRow
                  key={wallet.id}
                  className="cursor-pointer animate-table-row-in transition-[background-color,opacity] duration-150 hover:bg-muted/50"
                  style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                  onClick={() => setBalanceWallet(wallet)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setBalanceWallet(wallet);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={t("balances")}
                >
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm"
                        title={wallet.address}
                      >
                        {shortenAddress(wallet.address, 8)}
                      </span>
                      <CopyButton value={wallet.address} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <WalletTypeLabel type={wallet.type} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {wallet.note || (
                      <span className="italic opacity-60">
                        {t("emptyNote")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatRelativeDate(wallet.createdAt)}
                  </TableCell>
                  <TableCell
                    className={x402ActionsCellClass}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("columns.actions")}
                          disabled={retiringId === wallet.id}
                        >
                          {retiringId === wallet.id ? (
                            <Spinner size={16} />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-[140px]"
                      >
                        <DropdownMenuItem
                          onClick={() => setBalanceWallet(wallet)}
                        >
                          <WalletIcon className="mr-2 h-4 w-4 shrink-0" />
                          {t("balances")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditWallet(wallet)}>
                          <Pencil className="mr-2 h-4 w-4 shrink-0" />
                          {t("rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setWalletToRetire(wallet)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                          {t("retire")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
        key={
          dialogOpen
            ? `open-${slotAvailability.defaultType}-${slotAvailability.blockedTypes.join("|")}`
            : "closed"
        }
        open={dialogOpen}
        defaultType={slotAvailability.defaultType}
        blockedTypes={slotAvailability.blockedTypes}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
          void queryClient.invalidateQueries({ queryKey: ["x402", "budgets"] });
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
          void queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
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

function WalletTypeLabel({ type }: { type: WalletType }) {
  const t = useTranslations("App.X402.Wallets");
  const hintKey = type === "Purchasing" ? "purchasingHint" : "sellingHint";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{t(`types.${type}`)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
            <CircleHelp className="h-3.5 w-3.5" />
            <span className="sr-only">{t(hintKey)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t(hintKey)}</TooltipContent>
      </Tooltip>
    </span>
  );
}

function WalletsFiltersPopover({
  filters,
  activeFilterCount,
  onChange,
  onClear,
}: {
  filters: WalletListFilters;
  activeFilterCount: number;
  onChange: React.Dispatch<React.SetStateAction<WalletListFilters>>;
  onClear: () => void;
}) {
  const t = useTranslations("App.X402.Wallets");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={t("filtersAria")}
        >
          <ListFilter className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden rounded-xl border-border/80 p-0 shadow-lg"
        align="end"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">{t("filters")}</p>
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onClear}
            >
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="wallets-filter-type">{t("filterType")}</Label>
            <Select
              value={filters.type ?? FILTER_ALL}
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  type:
                    value === FILTER_ALL ? undefined : (value as WalletType),
                }))
              }
            >
              <SelectTrigger id="wallets-filter-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t("allTypes")}</SelectItem>
                <SelectItem value="Purchasing">
                  {t("types.Purchasing")}
                </SelectItem>
                <SelectItem value="Selling">{t("types.Selling")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WalletsActiveFilters({
  filters,
  onClear,
}: {
  filters: WalletListFilters;
  onClear: () => void;
}) {
  const t = useTranslations("App.X402.Wallets");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.type !== undefined ? (
        <Badge variant="outline" className="font-normal">
          {t(`types.${filters.type}`)}
        </Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={onClear}
      >
        {t("clearFilters")}
      </Button>
    </div>
  );
}

export function CreateWalletDialog({
  open,
  onClose,
  onSaved,
  defaultType = "Purchasing",
  blockedTypes = [],
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (wallet?: X402Wallet) => void;
  defaultType?: WalletType;
  blockedTypes?: ReadonlyArray<WalletType>;
}) {
  const t = useTranslations("App.X402.Wallets");
  const blockedTypeSet = useMemo(() => new Set(blockedTypes), [blockedTypes]);
  const initialType = blockedTypeSet.has(defaultType)
    ? defaultType === "Purchasing"
      ? "Selling"
      : "Purchasing"
    : defaultType;
  const [type, setType] = useState<WalletType>(initialType);
  const [note, setNote] = useState(() =>
    defaultWalletNoteForType(initialType, t),
  );
  const [keySource, setKeySource] = useState<KeySource>("generate");
  const [privateKey, setPrivateKey] = useState("");
  const [showImportKey, setShowImportKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [backup, setBackup] = useState<{
    address: string;
    privateKey: string;
  } | null>(null);
  const [createdWallet, setCreatedWallet] = useState<X402Wallet | null>(null);
  const backupConfirmedRef = useRef(false);
  const pendingWalletIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (createdWallet?.id) {
      pendingWalletIdRef.current = createdWallet.id;
    }
  }, [createdWallet?.id]);

  useEffect(() => {
    if (!open) {
      backupConfirmedRef.current = false;
      pendingWalletIdRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      const pendingWalletId = pendingWalletIdRef.current;
      if (pendingWalletId && !backupConfirmedRef.current) {
        void x402Fetch("/wallets/cancel-pending", {
          method: "POST",
          body: JSON.stringify({ id: pendingWalletId }),
          silentErrors: true,
        });
      }
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockedTypeSet.has(type)) {
      setError(t("typeAlreadyExists", { type: t(`types.${type}`) }));
      return;
    }
    const trimmed = privateKey.trim();
    if (keySource === "import" && !PRIVATE_KEY_REGEX.test(trimmed)) {
      setError(t("invalidPrivateKey"));
      return;
    }
    setError(null);
    setIsSaving(true);
    const trimmedNote = note.trim();
    const resolvedNote = trimmedNote || defaultWalletNoteForType(type, t);
    const result = await x402Mutate<X402Wallet & { privateKey: string | null }>(
      "/wallets",
      {
        method: "POST",
        body: JSON.stringify({
          type,
          note: resolvedNote,
          ...(keySource === "import" ? { privateKey: trimmed } : {}),
        }),
      },
      {
        errorMessage: t("createFailed"),
      },
    );
    setIsSaving(false);
    if (!result) return;
    const { privateKey: generatedPrivateKey, ...createdWallet } = result;
    if (keySource === "generate") {
      if (generatedPrivateKey) {
        setCreatedWallet(createdWallet);
        setBackup({
          address: createdWallet.address,
          privateKey: generatedPrivateKey,
        });
        return;
      }
      toast.error(t("missingPrivateKey"));
      onSaved(createdWallet);
      return;
    }
    toast.success(t("created"));
    onSaved(createdWallet);
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
          onDone={async () => {
            if (!createdWallet) return;
            const confirmed = await x402Mutate<X402Wallet>(
              "/wallets/confirm-backup",
              {
                method: "POST",
                body: JSON.stringify({ id: createdWallet.id }),
              },
              {
                successMessage: t("created"),
                errorMessage: t("createFailed"),
              },
            );
            if (!confirmed) return;
            backupConfirmedRef.current = true;
            pendingWalletIdRef.current = null;
            onSaved(createdWallet);
            setCreatedWallet(null);
            setBackup(null);
          }}
        />
      ) : (
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <X402DialogHeader
            title={t("createTitle")}
            titleHint={t("createDescription")}
          />
          <DialogBody
            stagger
            className="min-h-0 flex-1 space-y-5 overflow-y-auto"
          >
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <div className="space-y-2.5">
              <Label
                id="wallet-direction-label"
                className="text-sm font-medium"
              >
                {t("direction")}
              </Label>
              <div
                role="radiogroup"
                aria-labelledby="wallet-direction-label"
                className="grid grid-cols-2 gap-2.5"
              >
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
                  const isBlocked = blockedTypeSet.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (!isBlocked) {
                          setType(option.value);
                          setNote(defaultWalletNoteForType(option.value, t));
                          setError(null);
                        }
                      }}
                      disabled={isBlocked}
                      role="radio"
                      aria-checked={selected}
                      aria-disabled={isBlocked}
                      className={cn(
                        "flex flex-col gap-2.5 rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow,opacity] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-primary/80 bg-primary/5 shadow-sm ring-2 ring-primary/20"
                          : "border-border/70 bg-card/30 hover:border-border hover:bg-muted/40",
                        isBlocked &&
                          "cursor-not-allowed opacity-60 hover:border-border/70 hover:bg-card/30",
                      )}
                    >
                      <span className="flex items-center gap-2.5 text-sm font-medium">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[background-color,filter,opacity] duration-300 ease-in-out",
                            selected
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground",
                            isBlocked && "grayscale",
                          )}
                        >
                          <OptionIcon className="h-4 w-4" />
                        </span>
                        {t(`directionLabels.${option.value}`)}
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {isBlocked
                          ? t("typeAlreadyExists", {
                              type: t(`types.${option.value}`),
                            })
                          : option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-note" className="text-sm font-medium">
                {t("note")}
              </Label>
              <Input
                id="wallet-note"
                placeholder={t("notePlaceholder")}
                maxLength={250}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="space-y-2.5">
              <Label
                id="wallet-key-source-label"
                className="text-sm font-medium"
              >
                {t("keySource")}
              </Label>
              <div
                role="group"
                aria-labelledby="wallet-key-source-label"
                className="relative flex rounded-lg border border-border/70 bg-muted/40 p-1"
              >
                <div
                  className="absolute bottom-1 top-1 rounded-md bg-background shadow-sm transition-[left] duration-300 ease-in-out"
                  style={{
                    left: keySource === "generate" ? "4px" : "calc(50% + 4px)",
                    width: "calc(50% - 8px)",
                  }}
                />
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
                    aria-pressed={keySource === tab.value}
                    className={cn(
                      "relative z-10 min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      keySource === tab.value
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {keySource === "generate" ? (
                <p className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  {t("generateHint")}
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="relative">
                    <Textarea
                      id="wallet-private-key"
                      aria-label={t("importExisting")}
                      placeholder="0x…"
                      className="min-h-[76px] resize-none border-0 bg-background/80 pr-10 font-mono text-xs shadow-none focus-visible:ring-1"
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
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("importHint")}
                  </p>
                </div>
              )}
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
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || blockedTypeSet.has(type)}
            >
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

  const copyPrivateKey = async () => {
    await navigator.clipboard.writeText(privateKey);
    toast.success(t("keyCopied"));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <X402DialogHeader
        title={t("backupTitle")}
        description={t("backupDescription")}
      />
      <DialogBody stagger className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            {t("backupWarning")}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-2.5">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500" />
              {t("newWallet")}
            </Badge>
            <Badge variant="outline">{t(`types.${type}`)}</Badge>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("columns.address")}
            </p>
            <div className="flex items-center gap-1 rounded-lg bg-background/70 px-2.5 py-2 ring-1 ring-border/60">
              <span
                className="min-w-0 flex-1 truncate font-mono text-xs"
                title={address}
              >
                {shortenAddress(address, 12)}
              </span>
              <CopyButton value={address} className="h-7 w-7 shrink-0" />
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-medium">{t("keySource")}</p>
          <div
            className={cn(
              "relative min-h-[88px] overflow-hidden rounded-xl border border-dashed border-border/80 bg-muted/25 p-3 transition-[background-color,border-color] duration-300",
              revealed && "border-border bg-background/60",
            )}
          >
            <p
              className={cn(
                "break-all font-mono text-xs leading-relaxed transition-[filter,opacity] duration-300 ease-in-out",
                !revealed && "select-none blur-md opacity-80",
              )}
              aria-hidden={!revealed}
            >
              {privateKey}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  {t("hide")}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  {t("show")}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void copyPrivateKey()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {t("copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmDownloadOpen(true)}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
              {t("download")}
            </Button>
          </div>
        </div>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-[border-color,background-color] duration-300",
            confirmed
              ? "border-primary/25 bg-primary/5"
              : "border-border/70 bg-muted/20",
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
          <Check className="h-4 w-4" aria-hidden />
          {t("done")}
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
