"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleHelp,
  Link2,
  ListFilter,
  MoreVertical,
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402Networks, useX402Wallets } from "@/lib/hooks/use-x402";
import { cn, shortenAddress } from "@/lib/utils";
import { x402Fetch, x402Mutate } from "@/lib/x402/api";
import type { ChainSearchResult } from "@/lib/x402/chain-registry-types";
import { getDefaultStablecoinForChain } from "@/lib/x402/evm-config";
import type {
  X402Network,
  X402RpcProbeResult,
  X402Wallet,
} from "@/lib/x402/types";
import { isTestnetEnv } from "@/lib/x402-rail";

import { ChainLabel } from "./chain-icon";
import { ChainPickerDropdown } from "./chain-picker-dropdown";
import { WalletBalanceDialog } from "./wallet-extras";
import { CreateWalletDialog } from "./wallets-tab";
import { X402FormDialog } from "./x402-form-dialog";
import {
  x402ActionsCellClass,
  x402ActionsHeadClass,
  X402TableEmptyState,
  X402TableLoading,
  X402TableSearch,
} from "./x402-table-ui";
import { X402TestnetField } from "./x402-testnet-field";

const NO_FACILITATOR = "__none__";
const FILTER_ALL = "__all__";

function facilitatorWalletFromNetwork(network: X402Network): X402Wallet | null {
  if (!network.facilitatorWalletId) return null;

  return {
    id: network.facilitatorWalletId,
    address: network.facilitatorWalletAddress ?? network.facilitatorWalletId,
    type: "Selling",
    note: null,
    createdAt: "",
    updatedAt: "",
  };
}

type ChainListFilters = {
  enabled?: boolean;
  facilitatorSet?: boolean;
};

const chainSchema = z
  .object({
    caip2Id: z
      .string()
      .regex(
        /^eip155:\d+$/,
        "Must be a CAIP-2 EVM chain id, for example eip155:8453",
      ),
    displayName: z.string().min(1, "Required").max(120),
    rpcUrl: z.string().url("Must be a valid URL"),
    isTestnet: z.boolean(),
    isEnabled: z.boolean(),
    defaultAsset: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be an EVM token address")
      .or(z.literal(""))
      .optional(),
    facilitatorWalletId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.isEnabled &&
      (!data.facilitatorWalletId || data.facilitatorWalletId === NO_FACILITATOR)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A facilitator wallet is required to enable a chain",
        path: ["facilitatorWalletId"],
      });
    }
  });

type ChainFormValues = z.infer<typeof chainSchema>;

type RpcProbeViewState =
  | { status: "idle" }
  | { status: "checking"; key: string }
  | { status: "valid"; key: string }
  | { status: "invalid"; key: string; message: string };

function buildRpcProbeKey(caip2Id: string, rpcUrl: string) {
  return `${caip2Id}|${rpcUrl.trim()}`;
}

function isProbeableRpcUrl(rpcUrl: string) {
  try {
    const url = new URL(rpcUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function RpcUrlProbeIndicator({
  status,
  checkingLabel,
  validLabel,
  invalidMessage,
}: {
  status: RpcProbeViewState["status"];
  checkingLabel: string;
  validLabel: string;
  invalidMessage?: string;
}) {
  if (status === "idle") return null;

  const tooltipLabel =
    status === "checking"
      ? checkingLabel
      : status === "valid"
        ? validLabel
        : (invalidMessage ?? checkingLabel);

  const icon =
    status === "checking" ? (
      <Spinner
        key="rpc-probe-checking"
        size={16}
        className="text-muted-foreground"
      />
    ) : status === "valid" ? (
      <CheckCircle2
        key="rpc-probe-valid"
        className="h-4 w-4 animate-in fade-in zoom-in-90 fill-mode-both text-sky-500 duration-300"
        aria-hidden
      />
    ) : (
      <AlertTriangle
        key="rpc-probe-invalid"
        className="h-4 w-4 animate-rpc-probe-vibrate text-destructive"
        aria-hidden
      />
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex size-4 shrink-0 cursor-help items-center justify-center [&_svg]:block"
          aria-live="polite"
          aria-busy={status === "checking"}
        >
          {icon}
          <span className="sr-only">{tooltipLabel}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}

export function ChainsTab() {
  const t = useTranslations("App.X402.Chains");
  const tWallets = useTranslations("App.X402.Wallets");
  const { networks, isLoading, isRefetching, refetch } = useX402Networks();
  const chainIconSlugs = useChainRegistryIcons(networks.map((n) => n.caip2Id));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<X402Network | null>(null);
  const [balanceWallet, setBalanceWallet] = useState<X402Wallet | null>(null);
  const [busyChainId, setBusyChainId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilters, setListFilters] = useState<ChainListFilters>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 200);

  const activeFilterCount = useMemo(
    () =>
      [listFilters.enabled, listFilters.facilitatorSet].filter(
        (value) => value !== undefined,
      ).length,
    [listFilters],
  );

  const filteredNetworks = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return networks.filter((network) => {
      if (
        listFilters.enabled !== undefined &&
        network.isEnabled !== listFilters.enabled
      ) {
        return false;
      }

      if (listFilters.facilitatorSet === true && !network.facilitatorWalletId) {
        return false;
      }

      if (listFilters.facilitatorSet === false && network.facilitatorWalletId) {
        return false;
      }

      if (!query) return true;

      return (
        network.displayName.toLowerCase().includes(query) ||
        network.caip2Id.toLowerCase().includes(query) ||
        network.rpcUrl.toLowerCase().includes(query) ||
        network.defaultAsset?.toLowerCase().includes(query) ||
        network.facilitatorWalletAddress?.toLowerCase().includes(query) ||
        network.facilitatorWalletId?.toLowerCase().includes(query)
      );
    });
  }, [debouncedSearch, listFilters, networks]);

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

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (network: X402Network) => {
    setEditing(network);
    setDialogOpen(true);
  };

  const toggleChainEnabled = async (network: X402Network) => {
    setBusyChainId(network.id);
    const result = await x402Mutate<X402Network>(
      "/networks",
      {
        method: "POST",
        body: JSON.stringify({
          caip2Id: network.caip2Id,
          displayName: network.displayName,
          rpcUrl: network.rpcUrl,
          isTestnet: network.isTestnet,
          isEnabled: !network.isEnabled,
          defaultAsset: network.defaultAsset,
          facilitatorWalletId: network.facilitatorWalletId,
        }),
      },
      { errorMessage: t("toggleFailed") },
    );
    setBusyChainId(null);
    if (result) void refetch();
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
          <ChainsFiltersPopover
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
          <Button
            onClick={openAdd}
            size="icon"
            className="md:hidden"
            aria-label={t("addChain")}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            onClick={openAdd}
            className="hidden items-center gap-2 md:flex"
          >
            <Plus className="h-4 w-4" />
            {t("addChain")}
          </Button>
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <ChainsActiveFilters filters={listFilters} onClear={clearFilters} />
      ) : null}

      {isLoading ? (
        <X402TableLoading columns={5} withActions />
      ) : networks.length === 0 ? (
        <X402TableEmptyState
          icon={Link2}
          message={`${t("emptyTitle")}. ${t("emptyDescription")}`}
        />
      ) : filteredNetworks.length === 0 ? (
        <X402TableEmptyState icon={Link2} message={t("noSearchResults")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("columns.chain")}</TableHead>
                <TableHead>{t("columns.networkId")}</TableHead>
                <TableHead>{t("columns.rpcUrl")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.defaultAsset")}</TableHead>
                <TableHead>{t("columns.facilitator")}</TableHead>
                <TableHead className={x402ActionsHeadClass}>
                  {t("columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNetworks.map((network, index) => {
                const isDisabled = !network.isEnabled;
                const disabledRowFadeClass = cn(
                  "transition-opacity duration-300 ease-in-out",
                  isDisabled && "opacity-60",
                );
                const disabledIconToneClass = cn(
                  "shrink-0 transition-[filter] duration-300 ease-in-out",
                  isDisabled && "grayscale",
                );

                return (
                  <TableRow
                    key={network.id}
                    className="animate-table-row-in transition-[background-color] duration-150"
                    style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                  >
                    <TableCell className={disabledRowFadeClass}>
                      <ChainLabel
                        caip2Id={network.caip2Id}
                        name={network.displayName}
                        iconSlug={chainIconSlugs.get(network.caip2Id)}
                        iconSize={16}
                        className={cn(disabledIconToneClass, "font-medium")}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-mono text-sm text-muted-foreground",
                        disabledRowFadeClass,
                      )}
                    >
                      {network.caip2Id}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "max-w-[260px] truncate font-mono text-sm",
                        disabledRowFadeClass,
                      )}
                      title={network.rpcUrl}
                    >
                      {network.rpcUrl}
                    </TableCell>
                    <TableCell className={disabledRowFadeClass}>
                      <Badge
                        variant={network.isEnabled ? "success" : "secondary"}
                      >
                        {network.isEnabled ? t("enabled") : t("disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn("font-mono text-sm", disabledRowFadeClass)}
                    >
                      {network.defaultAsset ? (
                        <div className="flex items-center gap-1">
                          <span title={network.defaultAsset}>
                            {shortenAddress(network.defaultAsset, 6)}
                          </span>
                          <CopyButton value={network.defaultAsset} />
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm",
                        disabledRowFadeClass,
                        network.facilitatorWalletId &&
                          "cursor-pointer transition-colors duration-150 hover:text-foreground",
                      )}
                      onClick={() => {
                        const wallet = facilitatorWalletFromNetwork(network);
                        if (wallet) setBalanceWallet(wallet);
                      }}
                      onKeyDown={(e) => {
                        if (
                          network.facilitatorWalletId &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          const wallet = facilitatorWalletFromNetwork(network);
                          if (wallet) setBalanceWallet(wallet);
                        }
                      }}
                      tabIndex={network.facilitatorWalletId ? 0 : undefined}
                      role={network.facilitatorWalletId ? "button" : undefined}
                      aria-label={
                        network.facilitatorWalletId
                          ? tWallets("balances")
                          : undefined
                      }
                    >
                      {network.facilitatorWalletId ? (
                        <div className="flex items-center gap-1">
                          <span
                            className="font-mono"
                            title={
                              network.facilitatorWalletAddress ??
                              network.facilitatorWalletId
                            }
                          >
                            {network.facilitatorWalletAddress
                              ? shortenAddress(
                                  network.facilitatorWalletAddress,
                                  6,
                                )
                              : network.facilitatorWalletId}
                          </span>
                          <CopyButton
                            value={
                              network.facilitatorWalletAddress ??
                              network.facilitatorWalletId
                            }
                          />
                        </div>
                      ) : (
                        <Badge variant="warning">{t("notSet")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className={x402ActionsCellClass}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={t("actions")}
                            disabled={busyChainId === network.id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[140px]"
                        >
                          <DropdownMenuItem onClick={() => openEdit(network)}>
                            <Pencil className="mr-2 h-4 w-4 shrink-0" />
                            {t("editChain")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleChainEnabled(network)}
                            disabled={busyChainId === network.id}
                          >
                            {network.isEnabled ? (
                              <>
                                <Ban className="mr-2 h-4 w-4 shrink-0" />
                                {t("disable")}
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4 shrink-0" />
                                {t("enable")}
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ChainDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          void refetch();
        }}
      />

      <WalletBalanceDialog
        key={balanceWallet ? `bal-${balanceWallet.id}` : "bal-closed"}
        wallet={balanceWallet}
        open={balanceWallet != null}
        onClose={() => setBalanceWallet(null)}
      />
    </div>
  );
}

function ChainsFiltersPopover({
  filters,
  activeFilterCount,
  onChange,
  onClear,
}: {
  filters: ChainListFilters;
  activeFilterCount: number;
  onChange: React.Dispatch<React.SetStateAction<ChainListFilters>>;
  onClear: () => void;
}) {
  const t = useTranslations("App.X402.Chains");

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
            <Label htmlFor="chains-filter-status">{t("filterStatus")}</Label>
            <Select
              value={
                filters.enabled === undefined
                  ? FILTER_ALL
                  : filters.enabled
                    ? "enabled"
                    : "disabled"
              }
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  enabled:
                    value === FILTER_ALL ? undefined : value === "enabled",
                }))
              }
            >
              <SelectTrigger id="chains-filter-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t("allStatuses")}</SelectItem>
                <SelectItem value="enabled">{t("enabledOnly")}</SelectItem>
                <SelectItem value="disabled">{t("disabledOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chains-filter-facilitator">
              {t("filterFacilitator")}
            </Label>
            <Select
              value={
                filters.facilitatorSet === undefined
                  ? FILTER_ALL
                  : filters.facilitatorSet
                    ? "set"
                    : "not_set"
              }
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  facilitatorSet:
                    value === FILTER_ALL ? undefined : value === "set",
                }))
              }
            >
              <SelectTrigger id="chains-filter-facilitator" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>
                  {t("allFacilitators")}
                </SelectItem>
                <SelectItem value="set">
                  {t("facilitatorConfigured")}
                </SelectItem>
                <SelectItem value="not_set">
                  {t("facilitatorNotConfigured")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChainsActiveFilters({
  filters,
  onClear,
}: {
  filters: ChainListFilters;
  onClear: () => void;
}) {
  const t = useTranslations("App.X402.Chains");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.enabled !== undefined ? (
        <Badge variant="outline" className="font-normal">
          {filters.enabled ? t("enabled") : t("disabled")}
        </Badge>
      ) : null}
      {filters.facilitatorSet !== undefined ? (
        <Badge variant="outline" className="font-normal">
          {filters.facilitatorSet
            ? t("facilitatorConfigured")
            : t("facilitatorNotConfigured")}
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

export function ChainDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: X402Network | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("App.X402.Chains");
  const queryClient = useQueryClient();
  const { network } = usePaymentNetwork();
  const wantTestnet = isTestnetEnv(network);
  const { wallets, refetch: refetchWallets } = useX402Wallets(open, "Selling");
  const [isSaving, setIsSaving] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [rpcProbe, setRpcProbe] = useState<RpcProbeViewState>({
    status: "idle",
  });
  const [confirmRpcOpen, setConfirmRpcOpen] = useState(false);
  const [pendingFormData, setPendingFormData] =
    useState<ChainFormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ChainFormValues>({
    resolver: zodResolver(chainSchema),
    defaultValues: {
      caip2Id: editing?.caip2Id ?? "",
      displayName: editing?.displayName ?? "",
      rpcUrl: editing?.rpcUrl ?? "",
      isTestnet: editing?.isTestnet ?? wantTestnet,
      isEnabled: editing?.isEnabled ?? true,
      defaultAsset: editing?.defaultAsset ?? "",
      facilitatorWalletId: editing?.facilitatorWalletId ?? NO_FACILITATOR,
    },
  });

  const selectedCaip2Id = useWatch({ control, name: "caip2Id" });
  const watchedRpcUrl = useWatch({ control, name: "rpcUrl" });
  const watchedDisplayName = useWatch({ control, name: "displayName" });
  const debouncedRpcUrl = useDebouncedValue(watchedRpcUrl ?? "", 500);
  const debouncedCaip2Id = useDebouncedValue(selectedCaip2Id ?? "", 300);

  const runRpcProbe = useCallback(
    async (
      caip2Id: string,
      rpcUrl: string,
      displayName?: string,
    ): Promise<RpcProbeViewState> => {
      const key = buildRpcProbeKey(caip2Id, rpcUrl);
      setRpcProbe({ status: "checking", key });

      try {
        const result = await x402Fetch<X402RpcProbeResult>(
          "/networks/validate-rpc",
          {
            method: "POST",
            body: JSON.stringify({
              caip2Id,
              rpcUrl: rpcUrl.trim(),
              displayName: displayName?.trim() || undefined,
            }),
            silentErrors: true,
          },
        );

        if (result.ok) {
          const next: RpcProbeViewState = { status: "valid", key };
          setRpcProbe(next);
          return next;
        }

        const next: RpcProbeViewState = {
          status: "invalid",
          key,
          message: result.message,
        };
        setRpcProbe(next);
        return next;
      } catch {
        const next: RpcProbeViewState = {
          status: "invalid",
          key,
          message: t("rpcProbeFailed"),
        };
        setRpcProbe(next);
        return next;
      }
    },
    [t],
  );

  useEffect(() => {
    if (!open) return;

    const caip2Id = debouncedCaip2Id.trim();
    const rpcUrl = debouncedRpcUrl.trim();
    if (!caip2Id || !rpcUrl || !isProbeableRpcUrl(rpcUrl)) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Debounced RPC liveness probe on preset/url fill.
    void runRpcProbe(caip2Id, rpcUrl, watchedDisplayName);
  }, [
    debouncedCaip2Id,
    debouncedRpcUrl,
    open,
    runRpcProbe,
    watchedDisplayName,
  ]);

  const handleDialogClose = () => {
    setRpcProbe({ status: "idle" });
    setConfirmRpcOpen(false);
    setPendingFormData(null);
    onClose();
  };

  useEffect(() => {
    if (!open || editing) return;
    setValue("caip2Id", "");
    setValue("displayName", "");
    setValue("rpcUrl", "");
    setValue("defaultAsset", "");
    setValue("isTestnet", wantTestnet);
  }, [editing, open, setValue, wantTestnet]);

  const applyChainSuggestion = useCallback(
    (chain: ChainSearchResult) => {
      setValue("caip2Id", chain.caip2Id, { shouldValidate: true });
      setValue("displayName", chain.name, { shouldValidate: true });
      if (chain.rpcUrl) {
        setValue("rpcUrl", chain.rpcUrl, { shouldValidate: true });
      }
      const defaultAsset = getDefaultStablecoinForChain(chain.caip2Id);
      if (defaultAsset) {
        setValue("defaultAsset", defaultAsset, { shouldValidate: true });
      }
    },
    [setValue],
  );

  const saveChain = useCallback(
    async (data: ChainFormValues) => {
      setIsSaving(true);
      const result = await x402Mutate<X402Network>(
        "/networks",
        {
          method: "POST",
          body: JSON.stringify({
            caip2Id: data.caip2Id,
            displayName: data.displayName,
            rpcUrl: data.rpcUrl,
            isTestnet: wantTestnet,
            isEnabled: data.isEnabled,
            defaultAsset: data.defaultAsset ? data.defaultAsset : null,
            facilitatorWalletId:
              data.facilitatorWalletId &&
              data.facilitatorWalletId !== NO_FACILITATOR
                ? data.facilitatorWalletId
                : null,
          }),
        },
        {
          successMessage: editing ? t("updated") : t("added"),
          errorMessage: t("saveFailed"),
        },
      );
      setIsSaving(false);
      if (result) {
        setConfirmRpcOpen(false);
        setPendingFormData(null);
        onSaved();
      }
    },
    [editing, onSaved, t, wantTestnet],
  );

  const onValidSubmit = useCallback(
    async (data: ChainFormValues) => {
      const key = buildRpcProbeKey(data.caip2Id, data.rpcUrl);
      let probe: RpcProbeViewState = { status: "idle" };
      if (
        (rpcProbe.status === "valid" ||
          rpcProbe.status === "invalid" ||
          rpcProbe.status === "checking") &&
        rpcProbe.key === key
      ) {
        probe = rpcProbe;
      } else if (isProbeableRpcUrl(data.rpcUrl)) {
        probe = await runRpcProbe(data.caip2Id, data.rpcUrl, data.displayName);
      }

      if (probe.status === "checking") {
        toast.info(t("rpcProbeStillChecking"));
        return;
      }
      if (probe.status === "invalid") {
        setPendingFormData(data);
        setConfirmRpcOpen(true);
        return;
      }
      await saveChain(data);
    },
    [rpcProbe, runRpcProbe, saveChain, t],
  );

  const rpcProbeKeyForForm = buildRpcProbeKey(
    watchedRpcUrl && selectedCaip2Id ? selectedCaip2Id : "",
    watchedRpcUrl ?? "",
  );
  const showRpcProbeStatus =
    rpcProbe.status !== "idle" && rpcProbe.key === rpcProbeKeyForForm;

  return (
    <>
      <X402FormDialog
        open={open}
        onClose={handleDialogClose}
        title={editing ? t("editTitle") : t("addTitle")}
        titleHint={t("dialogDescription")}
        maxWidthClassName="sm:max-w-xl"
        bodyClassName="space-y-3 p-5"
        onSubmit={handleSubmit(onValidSubmit)}
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
              {isSaving
                ? t("saving")
                : editing
                  ? t("saveChanges")
                  : t("addChain")}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label htmlFor="chain-caip2Id" className="text-sm font-medium">
            {t("fields.caip2Id")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Input
              id="chain-caip2Id"
              placeholder="eip155:8453"
              className="min-w-0 flex-1 font-mono"
              readOnly={!!editing}
              {...register("caip2Id")}
            />
            {!editing ? (
              <ChainPickerDropdown
                selectedCaip2Id={selectedCaip2Id}
                selectedDisplayName={watchedDisplayName}
                onSelectChain={applyChainSuggestion}
                testnet={wantTestnet}
              />
            ) : null}
          </div>
          {errors.caip2Id ? (
            <p className="text-xs text-destructive">{errors.caip2Id.message}</p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="chain-displayName" className="text-sm font-medium">
              {t("fields.displayName")}
            </label>
            <Input
              id="chain-displayName"
              placeholder="Base"
              {...register("displayName")}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chain-defaultAsset" className="text-sm font-medium">
              {t("fields.defaultAsset")}
            </label>
            <Input
              id="chain-defaultAsset"
              placeholder="0x…"
              className="font-mono"
              {...register("defaultAsset")}
            />
            {errors.defaultAsset && (
              <p className="text-xs text-destructive">
                {errors.defaultAsset.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="chain-rpcUrl" className="text-sm font-medium">
            {t("fields.rpcUrl")}
          </label>
          <div className="relative">
            <Input
              id="chain-rpcUrl"
              placeholder="https://mainnet.base.org"
              className="pr-10"
              {...register("rpcUrl")}
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center">
              <div className="pointer-events-auto flex items-center justify-center">
                <RpcUrlProbeIndicator
                  status={showRpcProbeStatus ? rpcProbe.status : "idle"}
                  checkingLabel={t("rpcProbeChecking")}
                  validLabel={t("rpcProbeValid")}
                  invalidMessage={
                    rpcProbe.status === "invalid" ? rpcProbe.message : undefined
                  }
                />
              </div>
            </div>
          </div>
          {errors.rpcUrl ? (
            <p className="text-xs text-destructive">{errors.rpcUrl.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium">
                {t("fields.facilitator")}
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-3.5 w-3.5" />
                    <span className="sr-only">{t("facilitatorHint")}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {t("facilitatorHint")}
                </TooltipContent>
              </Tooltip>
            </div>
            {wallets.length === 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                onClick={() => setWalletDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("newWallet")}
              </Button>
            ) : null}
          </div>
          <Controller
            control={control}
            name="facilitatorWalletId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  aria-label={t("fields.facilitator")}
                  className="h-auto min-h-10 items-center py-2 text-left [&>span]:line-clamp-none"
                >
                  <SelectValue
                    placeholder={t("fields.facilitatorPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-max max-w-[min(100vw-2rem,24rem)]">
                  <SelectItem
                    value={NO_FACILITATOR}
                    className="whitespace-nowrap py-2 [&_span]:line-clamp-none"
                  >
                    {t("none")}
                  </SelectItem>
                  {wallets.map((wallet) => (
                    <SelectItem
                      key={wallet.id}
                      value={wallet.id}
                      className="whitespace-nowrap py-2 font-mono [&_span]:line-clamp-none"
                    >
                      {shortenAddress(wallet.address, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.facilitatorWalletId ? (
            <p className="text-xs text-destructive">
              {errors.facilitatorWalletId.message}
            </p>
          ) : null}
        </div>

        <CreateWalletDialog
          key={
            walletDialogOpen
              ? "chain-facilitator-wallet-open"
              : "chain-facilitator-wallet-closed"
          }
          open={walletDialogOpen}
          defaultType="Selling"
          blockedTypes={wallets.length > 0 ? ["Selling"] : []}
          onClose={() => setWalletDialogOpen(false)}
          onSaved={(wallet) => {
            setWalletDialogOpen(false);
            void queryClient
              .invalidateQueries({ queryKey: ["x402", "wallets"] })
              .then(() => refetchWallets())
              .then(() => {
                if (wallet?.id) {
                  setValue("facilitatorWalletId", wallet.id, {
                    shouldValidate: true,
                  });
                }
              });
          }}
        />

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <hr className="h-0 flex-1 border-0 border-t border-border/60" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("statusSection")}
            </span>
            <hr className="h-0 flex-1 border-0 border-t border-border/60" />
          </div>

          <Controller
            control={control}
            name="isTestnet"
            render={({ field }) => (
              <X402TestnetField
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
                disabled
              />
            )}
          />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">{t("fields.enabled")}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-3.5 w-3.5" />
                    <span className="sr-only">{t("enabledHint")}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {t("enabledHint")}
                </TooltipContent>
              </Tooltip>
            </div>
            <Controller
              control={control}
              name="isEnabled"
              render={({ field }) => (
                <Switch
                  aria-label={t("fields.enabled")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      </X402FormDialog>

      <ConfirmDialog
        open={confirmRpcOpen}
        onOpenChange={(nextOpen) => {
          if (!isSaving) setConfirmRpcOpen(nextOpen);
        }}
        title={t("rpcConfirmTitle")}
        description={t("rpcConfirmDescription", {
          rpcUrl: pendingFormData?.rpcUrl ?? watchedRpcUrl ?? "",
          chainId: pendingFormData?.caip2Id ?? selectedCaip2Id ?? "",
          details:
            rpcProbe.status === "invalid"
              ? rpcProbe.message
              : t("rpcProbeFailed"),
        })}
        confirmText={t("rpcConfirmContinue")}
        cancelText={t("cancel")}
        isLoading={isSaving}
        onConfirm={() => {
          if (pendingFormData) void saveChain(pendingFormData);
        }}
      />
    </>
  );
}
